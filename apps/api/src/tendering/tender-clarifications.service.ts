import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BidStatus,
  ClarificationMode,
  DocumentStatus,
} from '@prisma/client';
import { OpenAiClarificationService } from '../ai/openai-clarification.service';
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
} from '../documents/documents.types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import {
  buildClarificationAttachmentStorageKey,
  ClarificationAttachmentDownloadResponse,
  ClarificationAttachmentResponse,
  MAX_CLARIFICATION_ATTACHMENTS_PER_QUESTION,
  PresignClarificationAttachmentDto,
  PresignClarificationAttachmentResponse,
} from './clarification-attachments.types';
import {
  AnswerClarificationQuestionDto,
  ClarificationQuestionResponse,
  ClarificationQuestionsForClientResponse,
  SubmitBidClarificationQuestionsDto,
} from './tendering.types';

export const MAX_CLARIFICATION_QUESTIONS_PER_SUBMISSION = 30;
export const MAX_CLARIFICATION_QUESTION_LENGTH = 500;
export const MAX_CLARIFICATION_ANSWER_LENGTH = 4000;

function normalizeQuestionText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function normalizeQuestionKey(text: string): string {
  return normalizeQuestionText(text).toLowerCase();
}

function isQuestionAnswered(answer: string | null | undefined): boolean {
  return Boolean(answer?.trim());
}

type ClarificationQuestionRow = {
  id: string;
  questionText: string;
  sortOrder: number;
  answer: string | null;
  answeredAt: Date | null;
  sourceBidIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

function sortQuestionsByAskCount<T extends ClarificationQuestionRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const countDiff = b.sourceBidIds.length - a.sourceBidIds.length;
    if (countDiff !== 0) {
      return countDiff;
    }
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

function computeContractorAnswerStats(
  rows: Array<{ sourceBidIds: string[]; answer: string | null }>,
): { fullyAnsweredContractorCount: number; totalContractorCount: number } {
  const bidIds = new Set<string>();
  for (const row of rows) {
    for (const bidId of row.sourceBidIds) {
      bidIds.add(bidId);
    }
  }

  let fullyAnsweredContractorCount = 0;
  for (const bidId of bidIds) {
    const relevant = rows.filter((row) => row.sourceBidIds.includes(bidId));
    if (
      relevant.length > 0 &&
      relevant.every((row) => isQuestionAnswered(row.answer))
    ) {
      fullyAnsweredContractorCount += 1;
    }
  }

  return {
    fullyAnsweredContractorCount,
    totalContractorCount: bidIds.size,
  };
}

@Injectable()
export class TenderClarificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly openAi: OpenAiClarificationService,
    private readonly storage: StorageService,
  ) {}

  private mapAttachment(row: {
    id: string;
    originalName: string;
    contentType: string;
    sizeBytes: number | null;
    status: DocumentStatus;
    createdAt: Date;
    uploadedAt: Date | null;
  }): ClarificationAttachmentResponse {
    return {
      id: row.id,
      originalName: row.originalName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      uploadedAt: row.uploadedAt?.toISOString() ?? null,
    };
  }

  private mapQuestion(row: {
    id: string;
    questionText: string;
    sortOrder: number;
    answer: string | null;
    answeredAt: Date | null;
    sourceBidIds: string[];
    createdAt: Date;
    updatedAt: Date;
    attachments?: Array<{
      id: string;
      originalName: string;
      contentType: string;
      sizeBytes: number | null;
      status: DocumentStatus;
      createdAt: Date;
      uploadedAt: Date | null;
    }>;
  }): ClarificationQuestionResponse {
    return {
      id: row.id,
      questionText: row.questionText,
      sortOrder: row.sortOrder,
      answer: row.answer,
      answeredAt: row.answeredAt?.toISOString() ?? null,
      sourceBidIds: row.sourceBidIds,
      askedByCount: row.sourceBidIds.length,
      attachments: (row.attachments ?? [])
        .filter((item) => item.status !== DocumentStatus.deleted)
        .map((item) => this.mapAttachment(item)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private validateAttachmentUploadInput(dto: PresignClarificationAttachmentDto) {
    const fileName = dto.fileName?.trim();
    if (!fileName || fileName.length < 1) {
      throw new BadRequestException('fileName is required');
    }

    const contentType = dto.contentType?.trim().toLowerCase();
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException(
        'Unsupported content type. Allowed: PDF, images, Word, Excel, plain text, ZIP',
      );
    }

    if (
      !Number.isFinite(dto.sizeBytes) ||
      dto.sizeBytes < 1 ||
      dto.sizeBytes > MAX_UPLOAD_BYTES
    ) {
      throw new BadRequestException(
        `File size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`,
      );
    }
  }

  private async loadQuestionForClient(
    clientId: string,
    projectId: string,
    questionId: string,
  ) {
    await this.assertProjectOwner(projectId, clientId);
    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
    });
    if (!tender) {
      throw new NotFoundException('Tender not found');
    }

    const question = await this.prisma.tenderClarificationQuestion.findFirst({
      where: { id: questionId, tenderId: tender.id },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return { tender, question };
  }

  async listForClient(
    clientId: string,
    projectId: string,
  ): Promise<ClarificationQuestionsForClientResponse> {
    await this.assertProjectOwner(projectId, clientId);
    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
    });
    if (!tender) {
      return {
        questions: [],
        fullyAnsweredContractorCount: 0,
        totalContractorCount: 0,
      };
    }

    const rows = await this.prisma.tenderClarificationQuestion.findMany({
      where: { tenderId: tender.id },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const sorted = sortQuestionsByAskCount(rows);
    const stats = computeContractorAnswerStats(sorted);

    return {
      questions: sorted.map((row) => this.mapQuestion(row)),
      ...stats,
    };
  }

  async getSubmissionForContractor(
    userId: string,
    bidId: string,
  ): Promise<{ questions: string[]; submittedAt: string } | null> {
    const bid = await this.loadBidForContractor(userId, bidId);
    const submission = await this.prisma.bidClarificationSubmission.findUnique({
      where: { bidId: bid.id },
    });
    if (!submission) {
      return null;
    }

    const questions = Array.isArray(submission.questions)
      ? (submission.questions as string[])
      : [];

    return {
      questions,
      submittedAt: submission.submittedAt.toISOString(),
    };
  }

  async submitBidQuestions(
    userId: string,
    bidId: string,
    dto: SubmitBidClarificationQuestionsDto,
  ): Promise<{ questions: string[]; submittedAt: string }> {
    const bid = await this.loadBidForContractor(userId, bidId);
    const project = bid.tender.project;

    if (project.clarificationMode !== ClarificationMode.structured_qa) {
      throw new BadRequestException(
        'This project uses open chat clarification',
      );
    }

    if (bid.status !== BidStatus.clarifying) {
      throw new BadRequestException(
        'Questions can only be submitted during clarification',
      );
    }

    const existing = await this.prisma.bidClarificationSubmission.findUnique({
      where: { bidId: bid.id },
    });
    if (existing) {
      throw new BadRequestException(
        'Your question list was already submitted and cannot be changed',
      );
    }

    const questions = this.normalizeSubmittedQuestions(dto.questions);

    const submission = await this.prisma.bidClarificationSubmission.create({
      data: {
        bidId: bid.id,
        questions,
      },
    });

    await this.mergeQuestionsIntoTender(bid.tenderId, bid.id, questions);

    return {
      questions,
      submittedAt: submission.submittedAt.toISOString(),
    };
  }

  async answerQuestion(
    clientId: string,
    projectId: string,
    questionId: string,
    dto: AnswerClarificationQuestionDto,
  ): Promise<ClarificationQuestionResponse> {
    const project = await this.assertProjectOwner(projectId, clientId);

    if (project.clarificationMode !== ClarificationMode.structured_qa) {
      throw new BadRequestException(
        'This project does not use structured clarification',
      );
    }

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
    });
    if (!tender) {
      throw new NotFoundException('Tender not found');
    }

    const answer = dto.answer.trim();
    if (!answer) {
      throw new BadRequestException('Answer is required');
    }
    if (answer.length > MAX_CLARIFICATION_ANSWER_LENGTH) {
      throw new BadRequestException(
        `Answer must be at most ${MAX_CLARIFICATION_ANSWER_LENGTH} characters`,
      );
    }

    const question = await this.prisma.tenderClarificationQuestion.findFirst({
      where: { id: questionId, tenderId: tender.id },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const updated = await this.prisma.tenderClarificationQuestion.update({
      where: { id: questionId },
      data: {
        answer,
        answeredAt: new Date(),
        answeredById: clientId,
      },
      include: {
        attachments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return this.mapQuestion(updated);
  }

  async presignAttachment(
    clientId: string,
    projectId: string,
    questionId: string,
    dto: PresignClarificationAttachmentDto,
  ): Promise<PresignClarificationAttachmentResponse> {
    const { question } = await this.loadQuestionForClient(
      clientId,
      projectId,
      questionId,
    );
    this.validateAttachmentUploadInput(dto);

    const uploadedCount = question.attachments.filter(
      (item) => item.status === DocumentStatus.uploaded,
    ).length;
    const pendingCount = question.attachments.filter(
      (item) => item.status === DocumentStatus.pending,
    ).length;
    if (
      uploadedCount + pendingCount >=
      MAX_CLARIFICATION_ATTACHMENTS_PER_QUESTION
    ) {
      throw new BadRequestException(
        `At most ${MAX_CLARIFICATION_ATTACHMENTS_PER_QUESTION} files per answer`,
      );
    }

    const attachmentId = randomUUID();
    const fileName = dto.fileName.trim();
    const contentType = dto.contentType.trim().toLowerCase();
    const storageKey = buildClarificationAttachmentStorageKey(
      projectId,
      questionId,
      attachmentId,
      fileName,
    );

    await this.prisma.clarificationAnswerAttachment.create({
      data: {
        id: attachmentId,
        questionId,
        uploaderId: clientId,
        originalName: fileName,
        contentType,
        sizeBytes: dto.sizeBytes,
        storageKey,
        status: DocumentStatus.pending,
      },
    });

    const presigned = await this.storage.createPresignedUpload({
      storageKey,
      contentType,
      sizeBytes: dto.sizeBytes,
    });

    return {
      attachmentId,
      uploadUrl: presigned.uploadUrl,
      storageKey: presigned.storageKey,
      expiresInSeconds: presigned.expiresInSeconds,
    };
  }

  async completeAttachment(
    clientId: string,
    projectId: string,
    questionId: string,
    attachmentId: string,
  ): Promise<ClarificationAttachmentResponse> {
    await this.loadQuestionForClient(clientId, projectId, questionId);

    const attachment = await this.prisma.clarificationAnswerAttachment.findFirst(
      {
        where: { id: attachmentId, questionId },
      },
    );
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    if (attachment.status === DocumentStatus.uploaded) {
      return this.mapAttachment(attachment);
    }
    if (attachment.status === DocumentStatus.deleted) {
      throw new BadRequestException('Attachment was deleted');
    }

    const { sizeBytes } = await this.storage.verifyObject(attachment.storageKey);

    const updated = await this.prisma.clarificationAnswerAttachment.update({
      where: { id: attachmentId },
      data: {
        status: DocumentStatus.uploaded,
        sizeBytes,
        uploadedAt: new Date(),
      },
    });

    return this.mapAttachment(updated);
  }

  async deleteAttachment(
    clientId: string,
    projectId: string,
    questionId: string,
    attachmentId: string,
  ): Promise<void> {
    await this.loadQuestionForClient(clientId, projectId, questionId);

    const attachment = await this.prisma.clarificationAnswerAttachment.findFirst(
      {
        where: { id: attachmentId, questionId },
      },
    );
    if (!attachment || attachment.status === DocumentStatus.deleted) {
      throw new NotFoundException('Attachment not found');
    }

    await this.prisma.clarificationAnswerAttachment.update({
      where: { id: attachmentId },
      data: { status: DocumentStatus.deleted },
    });
  }

  async getAttachmentDownloadUrl(
    clientId: string,
    projectId: string,
    questionId: string,
    attachmentId: string,
  ): Promise<ClarificationAttachmentDownloadResponse> {
    await this.loadQuestionForClient(clientId, projectId, questionId);

    const attachment = await this.prisma.clarificationAnswerAttachment.findFirst(
      {
        where: {
          id: attachmentId,
          questionId,
          status: DocumentStatus.uploaded,
        },
      },
    );
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const presigned = await this.storage.createPresignedDownload(
      attachment.storageKey,
    );

    return {
      downloadUrl: presigned.downloadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
      originalName: attachment.originalName,
      contentType: attachment.contentType,
    };
  }

  async hasSubmittedQuestions(bidId: string): Promise<boolean> {
    const submission = await this.prisma.bidClarificationSubmission.findUnique({
      where: { bidId },
      select: { id: true },
    });
    return Boolean(submission);
  }

  async allQuestionsAnswered(tenderId: string): Promise<boolean> {
    const count = await this.prisma.tenderClarificationQuestion.count({
      where: { tenderId },
    });
    if (count === 0) {
      return false;
    }

    const unanswered = await this.prisma.tenderClarificationQuestion.count({
      where: {
        tenderId,
        OR: [{ answer: null }, { answer: '' }],
      },
    });

    return unanswered === 0;
  }

  async getClarificationProgress(tenderId: string): Promise<{
    totalQuestions: number;
    answeredQuestions: number;
    allAnswered: boolean;
  }> {
    const totalQuestions =
      await this.prisma.tenderClarificationQuestion.count({
        where: { tenderId },
      });
    const answeredQuestions =
      await this.prisma.tenderClarificationQuestion.count({
        where: {
          tenderId,
          answer: { not: null },
          NOT: { answer: '' },
        },
      });

    return {
      totalQuestions,
      answeredQuestions,
      allAnswered:
        totalQuestions > 0 && answeredQuestions === totalQuestions,
    };
  }

  private normalizeSubmittedQuestions(raw: string[]): string[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new BadRequestException('At least one question is required');
    }
    if (raw.length > MAX_CLARIFICATION_QUESTIONS_PER_SUBMISSION) {
      throw new BadRequestException(
        `At most ${MAX_CLARIFICATION_QUESTIONS_PER_SUBMISSION} questions allowed`,
      );
    }

    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const item of raw) {
      const text = normalizeQuestionText(String(item ?? ''));
      if (!text) {
        continue;
      }
      if (text.length > MAX_CLARIFICATION_QUESTION_LENGTH) {
        throw new BadRequestException(
          `Each question must be at most ${MAX_CLARIFICATION_QUESTION_LENGTH} characters`,
        );
      }
      const key = normalizeQuestionKey(text);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      normalized.push(text);
    }

    if (normalized.length === 0) {
      throw new BadRequestException('At least one valid question is required');
    }

    return normalized;
  }

  private async reorderQuestionsByAskCount(tenderId: string): Promise<void> {
    const rows = await this.prisma.tenderClarificationQuestion.findMany({
      where: { tenderId },
    });
    const sorted = sortQuestionsByAskCount(rows);
    await Promise.all(
      sorted.map((row, index) =>
        row.sortOrder === index
          ? Promise.resolve()
          : this.prisma.tenderClarificationQuestion.update({
              where: { id: row.id },
              data: { sortOrder: index },
            }),
      ),
    );
  }

  private collectNovelQuestions(
    candidates: string[],
    existingKeys: Set<string>,
    mergedKeys: Set<string>,
  ): string[] {
    const toInsert: string[] = [];
    const seen = new Set<string>();

    for (const raw of candidates) {
      const text = normalizeQuestionText(raw);
      if (!text || text.length > MAX_CLARIFICATION_QUESTION_LENGTH) {
        continue;
      }
      const key = normalizeQuestionKey(text);
      if (
        existingKeys.has(key) ||
        mergedKeys.has(key) ||
        seen.has(key)
      ) {
        continue;
      }
      seen.add(key);
      mergedKeys.add(key);
      existingKeys.add(key);
      toInsert.push(text);
    }

    return toInsert;
  }

  private async mergeQuestionsIntoTender(
    tenderId: string,
    bidId: string,
    newQuestions: string[],
  ): Promise<void> {
    const existingRows = await this.prisma.tenderClarificationQuestion.findMany({
      where: { tenderId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const existingTexts = existingRows.map((row) => row.questionText);
    const existingKeys = new Set(existingTexts.map(normalizeQuestionKey));

    const exactNovel: string[] = [];
    for (const question of newQuestions) {
      const key = normalizeQuestionKey(question);
      if (!existingKeys.has(key)) {
        exactNovel.push(question);
        existingKeys.add(key);
      } else {
        const match = existingRows.find(
          (row) => normalizeQuestionKey(row.questionText) === key,
        );
        if (match && !match.sourceBidIds.includes(bidId)) {
          await this.prisma.tenderClarificationQuestion.update({
            where: { id: match.id },
            data: { sourceBidIds: { push: bidId } },
          });
        }
      }
    }

    if (exactNovel.length === 0) {
      await this.reorderQuestionsByAskCount(tenderId);
      return;
    }

    const mergedBidIds = new Set<string>([bidId]);
    const aiResult = await this.openAi.mergeQuestions({
      existingQuestions: existingTexts,
      newQuestions: exactNovel,
    });

    const mergedKeys = new Set<string>();

    if (aiResult) {
      for (const merge of aiResult.mergeIntoExisting) {
        const row = existingRows[merge.existingIndex];
        if (!row) {
          continue;
        }
        for (const dup of merge.duplicateTexts) {
          mergedKeys.add(normalizeQuestionKey(dup));
        }
        const nextBidIds = [...row.sourceBidIds];
        if (!nextBidIds.includes(bidId)) {
          nextBidIds.push(bidId);
        }

        const updateData: {
          sourceBidIds: string[];
          questionText?: string;
        } = { sourceBidIds: nextBidIds };

        if (merge.canonicalText) {
          const canonical = normalizeQuestionText(merge.canonicalText);
          if (
            canonical &&
            canonical.length <= MAX_CLARIFICATION_QUESTION_LENGTH
          ) {
            updateData.questionText = canonical;
          }
        }

        await this.prisma.tenderClarificationQuestion.update({
          where: { id: row.id },
          data: updateData,
        });
      }
    }

    const novelCandidates = aiResult
      ? aiResult.novelQuestions.length > 0
        ? aiResult.novelQuestions
        : exactNovel.filter(
            (question) => !mergedKeys.has(normalizeQuestionKey(question)),
          )
      : exactNovel.filter(
          (question) => !mergedKeys.has(normalizeQuestionKey(question)),
        );

    const toInsert = this.collectNovelQuestions(
      novelCandidates,
      existingKeys,
      mergedKeys,
    );

    if (toInsert.length > 0) {
      const maxSort = existingRows.reduce(
        (max, row) => Math.max(max, row.sortOrder),
        -1,
      );

      await this.prisma.tenderClarificationQuestion.createMany({
        data: toInsert.map((questionText, index) => ({
          tenderId,
          questionText,
          sortOrder: maxSort + 1 + index,
          sourceBidIds: [...mergedBidIds],
        })),
      });
    }

    await this.reorderQuestionsByAskCount(tenderId);
  }

  async summarizeAnsweredForProject(projectId: string): Promise<string | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return null;
    }

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
    });
    if (!tender) {
      return null;
    }

    const rows = await this.prisma.tenderClarificationQuestion.findMany({
      where: { tenderId: tender.id },
      include: {
        attachments: {
          where: {
            status: DocumentStatus.uploaded,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const sorted = sortQuestionsByAskCount(rows);
    const items = sorted
      .filter((row) => row.answer?.trim())
      .map((row) => ({
        question: row.questionText,
        answer: row.answer!.trim(),
        attachments: row.attachments.map((file) => file.originalName),
      }));

    let summary: string | null = null;

    if (items.length > 0) {
      const aiSummary = await this.openAi.summarizeAnswers(project.title, items);
      summary = aiSummary
        ? aiSummary.summary
        : this.buildFallbackClarificationSummary(items);
      summary = this.appendAttachmentIndex(summary, items);
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { clarificationSummary: summary },
    });

    return summary;
  }

  private buildFallbackClarificationSummary(
    items: Array<{ question: string; answer: string; attachments: string[] }>,
  ): string {
    return items
      .map((item) => {
        let block = `Q: ${item.question}\nA: ${item.answer}`;
        if (item.attachments.length > 0) {
          block += `\nFiles: ${item.attachments.join(', ')}`;
        }
        return block;
      })
      .join('\n\n');
  }

  private appendAttachmentIndex(
    summary: string,
    items: Array<{ question: string; attachments: string[] }>,
  ): string {
    const withFiles = items.filter((item) => item.attachments.length > 0);
    if (withFiles.length === 0) {
      return summary;
    }

    const lines = withFiles.map(
      (item, index) =>
        `${index + 1}. ${item.question} — ${item.attachments.join(', ')}`,
    );

    return `${summary.trim()}\n\nAttached files:\n${lines.join('\n')}`;
  }

  private async assertProjectOwner(projectId: string, clientId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    return project;
  }

  private async loadBidForContractor(userId: string, bidId: string) {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        tender: { include: { project: true } },
      },
    });

    if (!bid) {
      throw new NotFoundException('Bid not found');
    }
    if (bid.contractorId !== profile.id) {
      throw new ForbiddenException('Access denied');
    }

    return bid;
  }
}
