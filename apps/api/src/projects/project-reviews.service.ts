import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CompletionRequestRole,
  ContractStatus,
  DocumentStatus,
  Prisma,
  ProjectStatus,
  BidStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ALLOWED_REVIEW_ATTACHMENT_TYPES,
  buildReviewAttachmentStorageKey,
  MAX_REVIEW_ATTACHMENT_BYTES,
  MAX_REVIEW_ATTACHMENTS,
  MAX_REVIEW_RATING,
  MIN_REVIEW_RATING,
  REVIEW_RATING_KEYS,
  type ReviewRatingCategory,
} from './project-review.constants';
import { assertCompletedUploadLimits } from '../documents/documents.types';
import {
  CompleteProjectDto,
  ConfirmProjectCompletionDto,
  ContractorReviewItem,
  BidContractorReviewsView,
  PresignProjectReviewAttachmentDto,
  ProjectCompletionContext,
  ProjectReviewAttachmentResponse,
} from './projects.types';

const COMPLETABLE_STATUSES: ProjectStatus[] = [ProjectStatus.active];

interface CompletionDraftReview {
  comment: string | null;
  ratings: Record<ReviewRatingCategory, number>;
  attachmentIds: string[];
}

@Injectable()
export class ProjectReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async getCompletionContextForClient(
    clientId: string,
    projectId: string,
  ): Promise<ProjectCompletionContext> {
    const project = await this.assertClientProject(clientId, projectId);
    const awarded = await this.loadAwardedBid(projectId);
    return this.buildCompletionContext(project, projectId, 'client', awarded);
  }

  async getCompletionContextForContractor(
    userId: string,
    projectId: string,
  ): Promise<ProjectCompletionContext> {
    const ctx = await this.loadContractorCompletionContext(userId, projectId);
    return this.buildCompletionContext(
      ctx.project,
      projectId,
      'contractor',
      ctx.awarded,
    );
  }

  async listForContractor(userId: string): Promise<ContractorReviewItem[]> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      return [];
    }

    const reviews = await this.prisma.contractorProjectReview.findMany({
      where: { contractorId: profile.id },
      include: {
        project: { select: { title: true } },
        client: { select: { displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((review) => {
      const ratings = review.ratingsJson as Record<string, number>;
      const averageRating = this.computeAverageRating(ratings);

      return {
        id: review.id,
        projectId: review.projectId,
        projectTitle: review.project.title,
        comment: review.comment,
        ratings,
        averageRating,
        createdAt: review.createdAt.toISOString(),
        clientName: review.client.displayName ?? review.client.email,
      };
    });
  }

  async listForBidClient(
    clientUserId: string,
    projectId: string,
    bidId: string,
  ): Promise<BidContractorReviewsView> {
    const contractorId = await this.assertClientMayViewBidContractor(
      clientUserId,
      projectId,
      bidId,
    );

    const reviews = await this.prisma.contractorProjectReview.findMany({
      where: { contractorId },
      include: {
        project: {
          select: { projectType: true, district: true },
        },
        attachments: {
          where: { status: DocumentStatus.uploaded },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const categoryTotals = Object.fromEntries(
      REVIEW_RATING_KEYS.map((key) => [key, { sum: 0, count: 0 }]),
    ) as Record<string, { sum: number; count: number }>;

    let overallSum = 0;
    const mappedReviews = await Promise.all(
      reviews.map(async (review) => {
        const ratings = review.ratingsJson as Record<string, number>;
        const averageRating = this.computeAverageRating(ratings);

        overallSum += averageRating;
        for (const key of REVIEW_RATING_KEYS) {
          const value = ratings[key];
          if (typeof value === 'number' && Number.isFinite(value)) {
            categoryTotals[key].sum += value;
            categoryTotals[key].count += 1;
          }
        }

        const attachments = await Promise.all(
          review.attachments.map(async (attachment) => {
            let previewUrl: string | null = null;
            if (
              attachment.contentType.startsWith('image/') &&
              this.storage.isConfigured()
            ) {
              try {
                const presigned = await this.storage.createPresignedDownload(
                  attachment.storageKey,
                );
                previewUrl = presigned.downloadUrl;
              } catch {
                previewUrl = null;
              }
            }

            return {
              id: attachment.id,
              originalName: attachment.originalName,
              contentType: attachment.contentType,
              sizeBytes: attachment.sizeBytes,
              previewUrl,
            };
          }),
        );

        return {
          id: review.id,
          projectType: review.project.projectType,
          district: review.project.district,
          completedAt: review.createdAt.toISOString(),
          averageRating,
          ratings,
          comment: review.comment,
          attachments,
        };
      }),
    );

    const categoryAverages: Record<string, number> = {};
    for (const key of REVIEW_RATING_KEYS) {
      const { sum, count } = categoryTotals[key];
      if (count > 0) {
        categoryAverages[key] = Math.round((sum / count) * 10) / 10;
      }
    }

    return {
      summary: {
        reviewCount: mappedReviews.length,
        averageRating:
          mappedReviews.length > 0
            ? Math.round((overallSum / mappedReviews.length) * 10) / 10
            : null,
        categoryAverages,
      },
      reviews: mappedReviews,
    };
  }

  async getReviewAttachmentDownloadForBidClient(
    clientUserId: string,
    projectId: string,
    bidId: string,
    reviewId: string,
    attachmentId: string,
  ): Promise<{
    downloadUrl: string;
    expiresInSeconds: number;
    originalName: string;
    contentType: string;
  }> {
    const contractorId = await this.assertClientMayViewBidContractor(
      clientUserId,
      projectId,
      bidId,
    );

    const attachment = await this.prisma.projectReviewAttachment.findFirst({
      where: {
        id: attachmentId,
        reviewId,
        status: DocumentStatus.uploaded,
        review: { contractorId },
      },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File storage is not configured');
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

  async presignAttachment(
    clientId: string,
    projectId: string,
    dto: PresignProjectReviewAttachmentDto,
  ) {
    const project = await this.assertClientProject(clientId, projectId);
    if (!COMPLETABLE_STATUSES.includes(project.status)) {
      throw new BadRequestException(
        'Review attachments can only be added before project completion',
      );
    }
    if (project.completionRequestedBy === CompletionRequestRole.client) {
      throw new BadRequestException(
        'Review attachments cannot be added while completion is pending confirmation',
      );
    }

    const fileName = dto.fileName?.trim();
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }

    const contentType = dto.contentType?.trim().toLowerCase();
    if (!contentType || !ALLOWED_REVIEW_ATTACHMENT_TYPES.has(contentType)) {
      throw new BadRequestException(
        'Unsupported file type. Use JPEG, PNG, WebP, or PDF.',
      );
    }

    if (
      !Number.isFinite(dto.sizeBytes) ||
      dto.sizeBytes < 1 ||
      dto.sizeBytes > MAX_REVIEW_ATTACHMENT_BYTES
    ) {
      throw new BadRequestException('Invalid file size');
    }

    const activeCount = await this.prisma.projectReviewAttachment.count({
      where: {
        projectId,
        clientId,
        status: { not: DocumentStatus.deleted },
      },
    });
    if (activeCount >= MAX_REVIEW_ATTACHMENTS) {
      throw new BadRequestException(
        `Review attachment limit reached (${MAX_REVIEW_ATTACHMENTS})`,
      );
    }

    const attachmentId = randomUUID();
    const storageKey = buildReviewAttachmentStorageKey(
      projectId,
      attachmentId,
      fileName,
    );

    await this.prisma.projectReviewAttachment.create({
      data: {
        id: attachmentId,
        projectId,
        clientId,
        originalName: fileName,
        contentType,
        sizeBytes: dto.sizeBytes,
        storageKey,
        status: DocumentStatus.pending,
      },
    });

    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File storage is not configured');
    }

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
    attachmentId: string,
  ): Promise<ProjectReviewAttachmentResponse> {
    const attachment = await this.prisma.projectReviewAttachment.findFirst({
      where: { id: attachmentId, projectId, clientId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    if (attachment.status === DocumentStatus.uploaded) {
      return this.toAttachmentResponse(attachment);
    }
    if (attachment.status === DocumentStatus.deleted) {
      throw new BadRequestException('Attachment was removed');
    }

    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File storage is not configured');
    }

    const { sizeBytes, contentType } = await this.storage.verifyObject(
      attachment.storageKey,
    );
    assertCompletedUploadLimits({
      sizeBytes,
      contentType: contentType ?? attachment.contentType,
      maxBytes: MAX_REVIEW_ATTACHMENT_BYTES,
      allowedContentTypes: ALLOWED_REVIEW_ATTACHMENT_TYPES,
    });

    const updated = await this.prisma.projectReviewAttachment.update({
      where: { id: attachmentId },
      data: {
        status: DocumentStatus.uploaded,
        sizeBytes,
        uploadedAt: new Date(),
      },
    });

    return this.toAttachmentResponse(updated);
  }

  async requestCompletionByClient(
    clientId: string,
    projectId: string,
    dto: CompleteProjectDto,
  ): Promise<void> {
    const project = await this.assertClientProject(clientId, projectId);
    this.assertCanRequestCompletion(project);

    const awarded = await this.requireAwardedBid(projectId);
    const draft = this.buildDraftReview(clientId, projectId, dto);
    await this.validateDraftAttachments(project.clientId, projectId, draft);

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        completionRequestedBy: CompletionRequestRole.client,
        completionRequestedAt: new Date(),
        completionDraftReviewJson: draft as unknown as Prisma.InputJsonValue,
      },
    });

    void this.notifications.dispatch(
      this.notifications.notifyContractorProjectCompletionRequested({
        contractorUserId: awarded.contractor.userId,
        projectId,
        projectTitle: project.title,
      }),
    );
    void this.notifications.dispatch(
      this.notifications.notifyAdminProjectCompletionRequested({
        projectId,
        projectTitle: project.title,
        requestedBy: 'client',
      }),
    );
  }

  async requestCompletionByContractor(
    userId: string,
    projectId: string,
  ): Promise<void> {
    const ctx = await this.loadContractorCompletionContext(userId, projectId);
    this.assertCanRequestCompletion(ctx.project);

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        completionRequestedBy: CompletionRequestRole.contractor,
        completionRequestedAt: new Date(),
        completionDraftReviewJson: Prisma.DbNull,
      },
    });

    void this.notifications.dispatch(
      this.notifications.notifyClientProjectCompletionRequested({
        clientUserId: ctx.project.clientId,
        projectId,
        projectTitle: ctx.project.title,
      }),
    );
    void this.notifications.dispatch(
      this.notifications.notifyAdminProjectCompletionRequested({
        projectId,
        projectTitle: ctx.project.title,
        requestedBy: 'contractor',
      }),
    );
  }

  async confirmCompletionByClient(
    clientId: string,
    projectId: string,
    dto?: ConfirmProjectCompletionDto,
  ): Promise<void> {
    const project = await this.assertClientProject(clientId, projectId);
    if (project.status === ProjectStatus.completed) {
      return;
    }
    if (project.completionRequestedBy !== CompletionRequestRole.contractor) {
      throw new BadRequestException(
        'No contractor completion request is pending confirmation',
      );
    }

    const awarded = await this.requireAwardedBid(projectId);
    const draft = dto ? this.buildOptionalDraftReview(clientId, projectId, dto) : null;
    if (draft) {
      await this.validateDraftAttachments(project.clientId, projectId, draft);
    }
    await this.finalizeProjectCompletion(projectId, draft, awarded);
  }

  async confirmCompletionByContractor(
    userId: string,
    projectId: string,
  ): Promise<void> {
    const ctx = await this.loadContractorCompletionContext(userId, projectId);
    const project = ctx.project;
    if (project.status === ProjectStatus.completed) {
      return;
    }
    if (project.completionRequestedBy !== CompletionRequestRole.client) {
      throw new BadRequestException(
        'No client completion request is pending confirmation',
      );
    }

    const draft = this.parseDraftReview(project.completionDraftReviewJson);
    await this.finalizeProjectCompletion(projectId, draft, ctx.awarded);
  }

  async completeProjectByAdmin(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.status === ProjectStatus.completed) {
      return;
    }
    if (!COMPLETABLE_STATUSES.includes(project.status)) {
      throw new BadRequestException(
        'Project can only be completed while it is active',
      );
    }

    const awarded = await this.requireAwardedBid(projectId);
    const draft =
      project.completionRequestedBy === CompletionRequestRole.client
        ? this.parseDraftReview(project.completionDraftReviewJson)
        : null;
    await this.finalizeProjectCompletion(projectId, draft, awarded);
  }

  /** @deprecated Use requestCompletionByClient */
  async completeProject(
    clientId: string,
    projectId: string,
    dto: CompleteProjectDto,
  ): Promise<void> {
    await this.requestCompletionByClient(clientId, projectId, dto);
  }

  private computeAverageRating(ratings: Record<string, number>): number {
    const values = REVIEW_RATING_KEYS.map((key) => ratings[key]).filter(
      (value) => typeof value === 'number' && Number.isFinite(value),
    );
    return values.length > 0
      ? Math.round(
          (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
        ) / 10
      : 0;
  }

  private async assertClientMayViewBidContractor(
    clientUserId: string,
    projectId: string,
    bidId: string,
  ): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientUserId) {
      throw new ForbiddenException('Access denied');
    }

    const bid = await this.prisma.bid.findFirst({
      where: {
        id: bidId,
        tender: { projectId },
        status: {
          in: [
            BidStatus.clarifying,
            BidStatus.enrolled,
            BidStatus.submitted,
            BidStatus.selected,
            BidStatus.rejected,
            BidStatus.withdrawn,
          ],
        },
      },
      select: { contractorId: true },
    });
    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    return bid.contractorId;
  }

  private normalizeRatings(
    input: Record<string, number>,
  ): Record<ReviewRatingCategory, number> {
    const ratings = {} as Record<ReviewRatingCategory, number>;
    for (const key of REVIEW_RATING_KEYS) {
      const value = input[key];
      if (
        !Number.isInteger(value) ||
        value < MIN_REVIEW_RATING ||
        value > MAX_REVIEW_RATING
      ) {
        throw new BadRequestException(
          `Rating "${key}" must be an integer from ${MIN_REVIEW_RATING} to ${MAX_REVIEW_RATING}`,
        );
      }
      ratings[key] = value;
    }
    return ratings;
  }

  private async loadAwardedBid(projectId: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      include: {
        awardedBid: {
          include: { contractor: { include: { user: true } } },
        },
      },
    });
    if (!tender?.awardedBidId || !tender.awardedBid) {
      return null;
    }
    return tender.awardedBid;
  }

  private async requireAwardedBid(projectId: string) {
    const awarded = await this.loadAwardedBid(projectId);
    if (!awarded) {
      throw new BadRequestException('No winning contractor found');
    }
    return awarded;
  }

  private async loadContractorCompletionContext(
    userId: string,
    projectId: string,
  ) {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new ForbiddenException('Access denied');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const awarded = await this.loadAwardedBid(projectId);
    if (!awarded || awarded.contractorId !== profile.id) {
      throw new ForbiddenException('Access denied');
    }

    return { project, awarded };
  }

  private async buildCompletionContext(
    project: {
      id: string;
      status: ProjectStatus;
      completionRequestedBy: CompletionRequestRole | null;
    },
    projectId: string,
    viewerRole: 'client' | 'contractor',
    awarded: {
      contractor: { companyName: string | null };
    } | null,
  ): Promise<ProjectCompletionContext> {
    const contract = await this.prisma.contract.findUnique({
      where: { projectId },
      select: { status: true },
    });
    const contractFullySigned =
      contract?.status === ContractStatus.fully_signed ||
      project.status === ProjectStatus.active;

    const completionRequestedBy = project.completionRequestedBy;
    const contractorName = awarded?.contractor.companyName ?? null;

    if (project.status === ProjectStatus.completed) {
      return {
        canRequestCompletion: false,
        canConfirmCompletion: false,
        completionRequestedBy: null,
        contractFullySigned,
        contractorName,
        reason: 'Project is already completed',
      };
    }

    if (!COMPLETABLE_STATUSES.includes(project.status)) {
      return {
        canRequestCompletion: false,
        canConfirmCompletion: false,
        completionRequestedBy,
        contractFullySigned,
        contractorName,
        reason: 'Select a winning contractor before completing the project',
      };
    }

    if (!awarded) {
      return {
        canRequestCompletion: false,
        canConfirmCompletion: false,
        completionRequestedBy,
        contractFullySigned,
        contractorName: null,
        reason: 'No winning contractor found for this project',
      };
    }

    const canRequestCompletion = !completionRequestedBy;
    const canConfirmCompletion =
      viewerRole === 'client'
        ? completionRequestedBy === CompletionRequestRole.contractor
        : completionRequestedBy === CompletionRequestRole.client;

    return {
      canRequestCompletion,
      canConfirmCompletion,
      completionRequestedBy,
      contractFullySigned,
      contractorName: contractorName ?? 'Contractor',
      reason: null,
    };
  }

  private assertCanRequestCompletion(project: {
    status: ProjectStatus;
    completionRequestedBy: CompletionRequestRole | null;
  }) {
    if (project.status === ProjectStatus.completed) {
      throw new BadRequestException('Project is already completed');
    }
    if (!COMPLETABLE_STATUSES.includes(project.status)) {
      throw new BadRequestException(
        'Project can only be completed after work has started',
      );
    }
    if (project.completionRequestedBy) {
      throw new BadRequestException(
        'A completion request is already pending confirmation',
      );
    }
  }

  private buildDraftReview(
    _clientId: string,
    _projectId: string,
    dto: CompleteProjectDto,
  ): CompletionDraftReview {
    const ratings = this.normalizeRatings(dto.ratings);
    const comment = dto.comment?.trim() || null;
    const attachmentIds = [...new Set(dto.attachmentIds ?? [])];

    if (attachmentIds.length > MAX_REVIEW_ATTACHMENTS) {
      throw new BadRequestException(
        `At most ${MAX_REVIEW_ATTACHMENTS} attachments allowed`,
      );
    }

    return {
      comment,
      ratings,
      attachmentIds,
    };
  }

  private buildOptionalDraftReview(
    _clientId: string,
    _projectId: string,
    dto: ConfirmProjectCompletionDto,
  ): CompletionDraftReview | null {
    const attachmentIds = [...new Set(dto.attachmentIds ?? [])];
    const comment = dto.comment?.trim() || null;
    const ratingsInput = dto.ratings ?? {};
    const hasAnyRating = REVIEW_RATING_KEYS.some(
      (key) =>
        typeof ratingsInput[key] === 'number' &&
        Number.isFinite(ratingsInput[key]) &&
        ratingsInput[key] >= 1,
    );
    const hasReviewContent =
      hasAnyRating || Boolean(comment) || attachmentIds.length > 0;

    if (!hasReviewContent) {
      return null;
    }

    if (!dto.ratings || !hasAnyRating) {
      throw new BadRequestException(
        'Please rate every category when submitting a review',
      );
    }

    const ratings = this.normalizeRatings(dto.ratings);

    if (attachmentIds.length > MAX_REVIEW_ATTACHMENTS) {
      throw new BadRequestException(
        `At most ${MAX_REVIEW_ATTACHMENTS} attachments allowed`,
      );
    }

    return {
      comment,
      ratings,
      attachmentIds,
    };
  }

  private async validateDraftAttachments(
    clientId: string,
    projectId: string,
    draft: CompletionDraftReview,
  ) {
    const attachmentIds = [...new Set(draft.attachmentIds)];
    if (attachmentIds.length === 0) {
      return;
    }

    const attachments = await this.prisma.projectReviewAttachment.findMany({
      where: {
        id: { in: attachmentIds },
        projectId,
        clientId,
        status: DocumentStatus.uploaded,
        reviewId: null,
      },
    });

    if (attachments.length !== attachmentIds.length) {
      throw new BadRequestException('One or more review attachments are invalid');
    }
  }

  private parseDraftReview(
    raw: unknown,
  ): CompletionDraftReview | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const draft = raw as Partial<CompletionDraftReview>;
    if (!draft.ratings || typeof draft.ratings !== 'object') {
      return null;
    }
    return {
      comment:
        typeof draft.comment === 'string' ? draft.comment.trim() || null : null,
      ratings: this.normalizeRatings(
        draft.ratings as Record<string, number>,
      ),
      attachmentIds: Array.isArray(draft.attachmentIds)
        ? draft.attachmentIds.filter((id) => typeof id === 'string')
        : [],
    };
  }

  private async finalizeProjectCompletion(
    projectId: string,
    draft: CompletionDraftReview | null,
    awarded: {
      id: string;
      contractorId: string;
      contractor: { userId: string };
    },
  ) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    if (draft) {
      const attachmentIds = [...new Set(draft.attachmentIds)];
      const attachments =
        attachmentIds.length > 0
          ? await this.prisma.projectReviewAttachment.findMany({
              where: {
                id: { in: attachmentIds },
                projectId,
                clientId: project.clientId,
                status: DocumentStatus.uploaded,
                reviewId: null,
              },
            })
          : [];

      if (attachments.length !== attachmentIds.length) {
        throw new BadRequestException(
          'One or more review attachments are invalid',
        );
      }

      await this.prisma.$transaction(async (tx) => {
        const review = await tx.contractorProjectReview.create({
          data: {
            projectId,
            clientId: project.clientId,
            contractorId: awarded.contractorId,
            bidId: awarded.id,
            comment: draft.comment,
            ratingsJson: draft.ratings,
          },
        });

        if (attachments.length > 0) {
          await tx.projectReviewAttachment.updateMany({
            where: { id: { in: attachments.map((item) => item.id) } },
            data: { reviewId: review.id },
          });
        }

        await tx.project.update({
          where: { id: projectId },
          data: {
            status: ProjectStatus.completed,
            isHidden: false,
            completionRequestedBy: null,
            completionRequestedAt: null,
            completionDraftReviewJson: Prisma.DbNull,
          },
        });
      });
      return;
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.completed,
        isHidden: false,
        completionRequestedBy: null,
        completionRequestedAt: null,
        completionDraftReviewJson: Prisma.DbNull,
      },
    });
  }

  private async assertClientProject(clientId: string, projectId: string) {
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

  private toAttachmentResponse(attachment: {
    id: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
    status: DocumentStatus;
    uploadedAt: Date | null;
  }): ProjectReviewAttachmentResponse {
    return {
      id: attachment.id,
      originalName: attachment.originalName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      status: attachment.status,
      uploadedAt: attachment.uploadedAt?.toISOString() ?? null,
    };
  }
}
