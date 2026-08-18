import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DocumentStatus,
  ProjectStatus,
  BidStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
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
  ContractorReviewItem,
  BidContractorReviewsView,
  PresignProjectReviewAttachmentDto,
  ProjectCompletionContext,
  ProjectReviewAttachmentResponse,
} from './projects.types';

const COMPLETABLE_STATUSES: ProjectStatus[] = [ProjectStatus.active];

@Injectable()
export class ProjectReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getCompletionContext(
    clientId: string,
    projectId: string,
  ): Promise<ProjectCompletionContext> {
    const project = await this.assertClientProject(clientId, projectId);

    if (project.status === ProjectStatus.completed) {
      return {
        canComplete: false,
        contractorName: null,
        reason: 'Project is already completed',
      };
    }

    if (!COMPLETABLE_STATUSES.includes(project.status)) {
      return {
        canComplete: false,
        contractorName: null,
        reason: 'Select a winning contractor before completing the project',
      };
    }

    const awarded = await this.loadAwardedBid(projectId);
    if (!awarded) {
      return {
        canComplete: false,
        contractorName: null,
        reason: 'No winning contractor found for this project',
      };
    }

    return {
      canComplete: true,
      contractorName: awarded.contractor.companyName ?? 'Contractor',
      reason: null,
    };
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

  async completeProject(
    clientId: string,
    projectId: string,
    dto: CompleteProjectDto,
  ): Promise<void> {
    const project = await this.assertClientProject(clientId, projectId);
    if (project.status === ProjectStatus.completed) {
      return;
    }
    if (!COMPLETABLE_STATUSES.includes(project.status)) {
      throw new BadRequestException(
        'Project can only be completed after a contractor is selected',
      );
    }

    const awarded = await this.loadAwardedBid(projectId);
    if (!awarded) {
      throw new BadRequestException('No winning contractor found');
    }

    const ratings = this.normalizeRatings(dto.ratings);
    const comment = dto.comment?.trim() || null;
    const attachmentIds = [...new Set(dto.attachmentIds ?? [])];

    if (attachmentIds.length > MAX_REVIEW_ATTACHMENTS) {
      throw new BadRequestException(
        `At most ${MAX_REVIEW_ATTACHMENTS} attachments allowed`,
      );
    }

    const attachments =
      attachmentIds.length > 0
        ? await this.prisma.projectReviewAttachment.findMany({
            where: {
              id: { in: attachmentIds },
              projectId,
              clientId,
              status: DocumentStatus.uploaded,
              reviewId: null,
            },
          })
        : [];

    if (attachments.length !== attachmentIds.length) {
      throw new BadRequestException('One or more review attachments are invalid');
    }

    await this.prisma.$transaction(async (tx) => {
      const review = await tx.contractorProjectReview.create({
        data: {
          projectId,
          clientId,
          contractorId: awarded.contractorId,
          bidId: awarded.id,
          comment,
          ratingsJson: ratings,
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
        },
      });
    });
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
          include: { contractor: true },
        },
      },
    });
    if (!tender?.awardedBidId || !tender.awardedBid) {
      return null;
    }
    return tender.awardedBid;
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
