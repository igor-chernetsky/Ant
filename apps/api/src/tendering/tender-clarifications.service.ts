import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BidStatus,
  ClarificationMode,
} from '@prisma/client';
import { OpenAiClarificationService } from '../ai/openai-clarification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import {
  AnswerClarificationQuestionDto,
  ClarificationQuestionResponse,
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

@Injectable()
export class TenderClarificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly openAi: OpenAiClarificationService,
  ) {}

  private mapQuestion(row: {
    id: string;
    questionText: string;
    sortOrder: number;
    answer: string | null;
    answeredAt: Date | null;
    sourceBidIds: string[];
    createdAt: Date;
    updatedAt: Date;
  }): ClarificationQuestionResponse {
    return {
      id: row.id,
      questionText: row.questionText,
      sortOrder: row.sortOrder,
      answer: row.answer,
      answeredAt: row.answeredAt?.toISOString() ?? null,
      sourceBidIds: row.sourceBidIds,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listForClient(
    clientId: string,
    projectId: string,
  ): Promise<ClarificationQuestionResponse[]> {
    await this.assertProjectOwner(projectId, clientId);
    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
    });
    if (!tender) {
      return [];
    }

    const rows = await this.prisma.tenderClarificationQuestion.findMany({
      where: { tenderId: tender.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((row) => this.mapQuestion(row));
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
    });

    return this.mapQuestion(updated);
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
        await this.prisma.tenderClarificationQuestion.update({
          where: { id: row.id },
          data: { sourceBidIds: nextBidIds },
        });
      }
    }

    const toInsert: string[] = [];
    for (const question of exactNovel) {
      const key = normalizeQuestionKey(question);
      if (mergedKeys.has(key)) {
        continue;
      }
      toInsert.push(question);
    }

    if (toInsert.length === 0) {
      return;
    }

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
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const items = rows
      .filter((row) => row.answer?.trim())
      .map((row) => ({
        question: row.questionText,
        answer: row.answer!.trim(),
      }));

    let summary: string | null = null;

    if (items.length > 0) {
      const aiSummary = await this.openAi.summarizeAnswers(project.title, items);
      summary = aiSummary
        ? aiSummary.summary
        : items
            .map((item) => `Q: ${item.question} A: ${item.answer}`)
            .join('\n\n');
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { clarificationSummary: summary },
    });

    return summary;
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
