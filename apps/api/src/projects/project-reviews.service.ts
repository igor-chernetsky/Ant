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
import {
  CompleteProjectDto,
  ContractorReviewItem,
  PresignProjectReviewAttachmentDto,
  ProjectCompletionContext,
  ProjectReviewAttachmentResponse,
} from './projects.types';

const COMPLETABLE_STATUSES: ProjectStatus[] = [
  ProjectStatus.contractor_selected,
  ProjectStatus.active,
];

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
      const values = REVIEW_RATING_KEYS.map((key) => ratings[key]).filter(
        (value) => typeof value === 'number' && Number.isFinite(value),
      );
      const averageRating =
        values.length > 0
          ? Math.round(
              (values.reduce((sum, value) => sum + value, 0) / values.length) *
                10,
            ) / 10
          : 0;

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

    const { sizeBytes } = await this.storage.verifyObject(attachment.storageKey);

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
