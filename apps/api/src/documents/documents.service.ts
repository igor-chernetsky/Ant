import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BidStatus,
  DefectEventKind,
  Document,
  DocumentCategory,
  DocumentStatus,
  ProjectStatus,
  Prisma,
} from '@prisma/client';
import { DocumentAnalysisService } from '../ai/document-analysis.service';
import {
  computeReadinessScore,
  ProjectBriefV1,
} from '../projects/project-brief';
import { ProjectsService } from '../projects/projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { ImageThumbnailService } from '../storage/image-thumbnail.service';
import { StorageService } from '../storage/storage.service';
import {
  ALLOWED_CONTENT_TYPES,
  assertCompletedUploadLimits,
  buildDocumentThumbnailKey,
  buildStorageKey,
  DocumentDownloadVariant,
  DocumentResponse,
  DownloadUrlResponse,
  inferDocumentCategory,
  isReferenceOnlyDocumentCategory,
  MAX_UPLOAD_BYTES,
  PresignUploadDto,
  PresignUploadResponse,
} from './documents.types';

const DELETABLE_DOCUMENT_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.draft,
  ProjectStatus.intake,
  ProjectStatus.ready_for_estimate,
  ProjectStatus.estimated,
];

const CLIENT_DEFECT_ATTACHMENT_EVENT_KINDS: DefectEventKind[] = [
  DefectEventKind.created,
  DefectEventKind.resubmitted,
  DefectEventKind.completion_rejected,
];

const EXECUTOR_DEFECT_ATTACHMENT_EVENT_KINDS: DefectEventKind[] = [
  DefectEventKind.completed,
];

@Injectable()
export class DocumentsService {
  private readonly thumbnailJobs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documentAnalysis: DocumentAnalysisService,
    private readonly thumbnails: ImageThumbnailService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
  ) {}

  private toResponse(doc: Document): DocumentResponse {
    return {
      id: doc.id,
      projectId: doc.projectId,
      originalName: doc.originalName,
      contentType: doc.contentType,
      sizeBytes: doc.sizeBytes,
      category: doc.category,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
      uploadedAt: doc.uploadedAt?.toISOString() ?? null,
      hasThumbnail: Boolean(doc.thumbnailStorageKey),
    };
  }

  private async assertProjectOwner(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return project;
  }

  private async assertCanAttachToDefectEvent(
    projectId: string,
    userId: string,
    defectEventId: string,
  ): Promise<{ defectId: string; defectEventId: string }> {
    const event = await this.prisma.defectEvent.findFirst({
      where: { id: defectEventId },
      include: {
        defect: {
          include: {
            project: {
              include: {
                tender: {
                  include: {
                    awardedBid: {
                      include: {
                        contractor: { select: { id: true, userId: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!event || event.defect.projectId !== projectId) {
      throw new NotFoundException('Defect event not found');
    }

    if (event.defect.project.status !== ProjectStatus.active) {
      throw new BadRequestException(
        'Defect attachments are only allowed on active projects',
      );
    }

    const bid = event.defect.project.tender?.awardedBid;
    if (!bid || bid.status !== BidStatus.selected) {
      throw new BadRequestException('No awarded contractor on this project');
    }

    const isClient = event.defect.project.clientId === userId;
    let isContractor = false;
    if (!isClient) {
      const profile = await this.prisma.contractorProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      isContractor = Boolean(profile && profile.id === bid.contractorId);
    }

    if (CLIENT_DEFECT_ATTACHMENT_EVENT_KINDS.includes(event.kind)) {
      if (!isClient) {
        throw new ForbiddenException('Only the project owner can attach here');
      }
    } else if (EXECUTOR_DEFECT_ATTACHMENT_EVENT_KINDS.includes(event.kind)) {
      if (!isContractor) {
        throw new ForbiddenException(
          'Only the awarded contractor can attach here',
        );
      }
    } else {
      throw new BadRequestException('This event does not accept attachments');
    }

    return { defectId: event.defectId, defectEventId: event.id };
  }

  private async assertPublicProjectView(
    projectId: string,
    userId: string | null = null,
    options?: {
      isAdmin?: boolean;
      isContractorRole?: boolean;
      isDesignerRole?: boolean;
      inviteToken?: string | null;
    },
  ) {
    return this.projects.assertCanOpenProject(projectId, userId, options);
  }

  private validateUploadInput(dto: PresignUploadDto) {
    const fileName = dto.fileName?.trim();
    if (!fileName || fileName.length < 1) {
      throw new BadRequestException('fileName is required');
    }

    const contentType = dto.contentType?.trim().toLowerCase();
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException(
        `Unsupported content type. Allowed: PDF, images, Word, Excel, plain text, ZIP`,
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

  async listForProject(
    projectId: string,
    userId: string,
    options?: {
      isAdmin?: boolean;
      isContractorRole?: boolean;
      isDesignerRole?: boolean;
    },
  ): Promise<DocumentResponse[]> {
    const project = await this.assertPublicProjectView(
      projectId,
      userId,
      options,
    );
    const isOwner = project.clientId === userId;

    const docs = await this.prisma.document.findMany({
      where: {
        projectId,
        defectId: null,
        category: { not: DocumentCategory.payment_slip },
        status: isOwner
          ? { not: DocumentStatus.deleted }
          : DocumentStatus.uploaded,
      },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((doc) => this.toResponse(doc));
  }

  async listForPublicProject(
    projectId: string,
    userId: string | null = null,
    options?: {
      isAdmin?: boolean;
      isContractorRole?: boolean;
      isDesignerRole?: boolean;
      inviteToken?: string | null;
    },
  ): Promise<DocumentResponse[]> {
    await this.assertPublicProjectView(projectId, userId, options);

    const docs = await this.prisma.document.findMany({
      where: {
        projectId,
        defectId: null,
        category: { not: DocumentCategory.payment_slip },
        status: DocumentStatus.uploaded,
      },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((doc) => this.toResponse(doc));
  }

  async presignUpload(
    projectId: string,
    userId: string,
    dto: PresignUploadDto,
  ): Promise<PresignUploadResponse> {
    this.validateUploadInput(dto);

    let defectId: string | undefined;
    let defectEventId: string | undefined;

    if (dto.defectEventId?.trim()) {
      const linked = await this.assertCanAttachToDefectEvent(
        projectId,
        userId,
        dto.defectEventId.trim(),
      );
      defectId = linked.defectId;
      defectEventId = linked.defectEventId;
    } else if (dto.defectId?.trim()) {
      throw new BadRequestException(
        'defectEventId is required when uploading defect attachments',
      );
    } else {
      await this.assertProjectOwner(projectId, userId);
    }

    const documentId = randomUUID();
    const fileName = dto.fileName.trim();
    const contentType = dto.contentType.trim().toLowerCase();
    const storageKey = buildStorageKey(projectId, documentId, fileName);
    const category =
      dto.category ??
      (defectEventId
        ? contentType.startsWith('image/')
          ? 'photo'
          : 'other'
        : 'other');

    await this.prisma.document.create({
      data: {
        id: documentId,
        projectId,
        uploaderId: userId,
        originalName: fileName,
        contentType,
        sizeBytes: dto.sizeBytes,
        storageKey,
        category,
        status: DocumentStatus.pending,
        defectId: defectId ?? null,
        defectEventId: defectEventId ?? null,
      },
    });

    const presigned = await this.storage.createPresignedUpload({
      storageKey,
      contentType,
      sizeBytes: dto.sizeBytes,
    });

    return {
      documentId,
      uploadUrl: presigned.uploadUrl,
      storageKey: presigned.storageKey,
      expiresInSeconds: presigned.expiresInSeconds,
    };
  }

  async completeUpload(
    projectId: string,
    documentId: string,
    userId: string,
  ): Promise<DocumentResponse> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    if (doc.defectEventId) {
      await this.assertCanAttachToDefectEvent(
        projectId,
        userId,
        doc.defectEventId,
      );
    } else {
      await this.assertProjectOwner(projectId, userId);
    }

    if (doc.status === DocumentStatus.uploaded) {
      this.scheduleThumbnailGeneration(doc);
      return this.toResponse(doc);
    }

    if (doc.status === DocumentStatus.deleted) {
      throw new BadRequestException('Document was deleted');
    }

    const { sizeBytes, contentType } = await this.storage.verifyObject(
      doc.storageKey,
    );
    assertCompletedUploadLimits({
      sizeBytes,
      contentType: contentType ?? doc.contentType,
    });

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.uploaded,
        sizeBytes,
        uploadedAt: new Date(),
      },
    });

    this.scheduleThumbnailGeneration(updated);
    if (
      !doc.defectId &&
      !isReferenceOnlyDocumentCategory(updated.category)
    ) {
      this.documentAnalysis.scheduleAnalysis(projectId, documentId);
    }

    return this.toResponse(updated);
  }

  /**
   * Register an already-uploaded object (e.g. clarification attachment) as a
   * project Document so it appears in Documents and can be AI-analyzed.
   */
  async registerExistingUpload(input: {
    projectId: string;
    uploaderId: string;
    originalName: string;
    contentType: string;
    sizeBytes: number | null;
    storageKey: string;
    category?: DocumentCategory;
  }): Promise<Document> {
    const existing = await this.prisma.document.findUnique({
      where: { storageKey: input.storageKey },
    });
    if (existing && existing.status !== DocumentStatus.deleted) {
      this.scheduleThumbnailGeneration(existing);
      return existing;
    }

    if (existing?.status === DocumentStatus.deleted) {
      const restored = await this.prisma.document.update({
        where: { id: existing.id },
        data: {
          projectId: input.projectId,
          uploaderId: input.uploaderId,
          originalName: input.originalName,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          category:
            input.category ??
            inferDocumentCategory(input.contentType, input.originalName),
          status: DocumentStatus.uploaded,
          uploadedAt: new Date(),
          thumbnailStorageKey: null,
        },
      });
      this.scheduleThumbnailGeneration(restored);
      return restored;
    }

    const created = await this.prisma.document.create({
      data: {
        projectId: input.projectId,
        uploaderId: input.uploaderId,
        originalName: input.originalName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey,
        category:
          input.category ??
          inferDocumentCategory(input.contentType, input.originalName),
        status: DocumentStatus.uploaded,
        uploadedAt: new Date(),
      },
    });
    this.scheduleThumbnailGeneration(created);
    return created;
  }

  async getDownloadUrl(
    projectId: string,
    documentId: string,
    userId: string,
    variant: DocumentDownloadVariant = 'original',
    options?: {
      isAdmin?: boolean;
      isContractorRole?: boolean;
      isDesignerRole?: boolean;
    },
  ): Promise<DownloadUrlResponse> {
    await this.assertPublicProjectView(projectId, userId, options);

    const doc = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        projectId,
        status: DocumentStatus.uploaded,
      },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    return this.buildDownloadResponse(doc, variant);
  }

  async getPublicDownloadUrl(
    projectId: string,
    documentId: string,
    variant: DocumentDownloadVariant = 'original',
    options?: {
      authenticated?: boolean;
      userId?: string | null;
      isAdmin?: boolean;
      isContractorRole?: boolean;
      isDesignerRole?: boolean;
      inviteToken?: string | null;
    },
  ): Promise<DownloadUrlResponse> {
    await this.assertPublicProjectView(projectId, options?.userId ?? null, {
      isAdmin: options?.isAdmin,
      isContractorRole: options?.isContractorRole,
      isDesignerRole: options?.isDesignerRole,
      inviteToken: options?.inviteToken,
    });

    const inviteAllowsDownload = Boolean(options?.inviteToken?.trim());

    // Thumbnails stay public for gallery previews once open ACL passed;
    // originals require sign-in, or a valid tender invite token.
    if (variant !== 'thumb' && !options?.authenticated && !inviteAllowsDownload) {
      throw new UnauthorizedException(
        'Sign in to download project documents',
      );
    }

    const doc = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        projectId,
        status: DocumentStatus.uploaded,
      },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    return this.buildDownloadResponse(doc, variant);
  }

  async deleteDocument(
    projectId: string,
    documentId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.assertProjectOwner(projectId, userId);

    if (!DELETABLE_DOCUMENT_PROJECT_STATUSES.includes(project.status)) {
      throw new BadRequestException(
        'Documents cannot be removed after the tender has started',
      );
    }

    const doc = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        projectId,
        status: { not: DocumentStatus.deleted },
      },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    if (this.storage.isConfigured() && doc.status === DocumentStatus.uploaded) {
      const keys = [doc.storageKey, doc.thumbnailStorageKey].filter(
        (key): key is string => Boolean(key),
      );
      for (const key of keys) {
        try {
          await this.storage.deleteObject(key);
        } catch {
          // Best-effort S3 cleanup
        }
      }
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.deleted,
        thumbnailStorageKey: null,
      },
    });

    await this.removeDocumentFromBrief(projectId, documentId);
    await this.documentAnalysis.refreshAfterDocumentRemoved(projectId);
  }

  scheduleThumbnailGeneration(
    doc: Pick<
      Document,
      'id' | 'projectId' | 'storageKey' | 'contentType' | 'thumbnailStorageKey'
    >,
  ): void {
    if (!doc.contentType.startsWith('image/')) {
      return;
    }
    if (doc.thumbnailStorageKey) {
      return;
    }
    if (!this.storage.isConfigured()) {
      return;
    }
    if (this.thumbnailJobs.has(doc.id)) {
      return;
    }

    this.thumbnailJobs.add(doc.id);
    void (async () => {
      try {
        const buffer = await this.storage.getObjectBuffer(doc.storageKey);
        const thumbBuffer = await this.thumbnails.createJpegThumbnail(
          buffer,
          doc.contentType,
        );
        if (!thumbBuffer) {
          return;
        }

        const thumbnailStorageKey = buildDocumentThumbnailKey(
          doc.projectId,
          doc.id,
        );
        await this.storage.putObject({
          storageKey: thumbnailStorageKey,
          body: thumbBuffer,
          contentType: 'image/jpeg',
        });

        await this.prisma.document.update({
          where: { id: doc.id },
          data: { thumbnailStorageKey },
        });
      } catch {
        // Thumbnail is optional — original image remains available.
      } finally {
        this.thumbnailJobs.delete(doc.id);
      }
    })();
  }

  private async buildDownloadResponse(
    doc: Document,
    variant: DocumentDownloadVariant,
  ): Promise<DownloadUrlResponse> {
    let storageKey = doc.storageKey;
    let contentType = doc.contentType;

    if (variant === 'thumb' && doc.contentType.startsWith('image/')) {
      if (doc.thumbnailStorageKey) {
        storageKey = doc.thumbnailStorageKey;
        contentType = 'image/jpeg';
      } else {
        this.scheduleThumbnailGeneration(doc);
      }
    }

    const presigned = await this.storage.createPresignedDownload(storageKey);

    return {
      downloadUrl: presigned.downloadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
      originalName: doc.originalName,
      contentType,
    };
  }

  private async removeDocumentFromBrief(
    projectId: string,
    documentId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return;

    const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
    const documentInsights = (brief.ai?.documentInsights ?? []).filter(
      (insight) => insight.documentId !== documentId,
    );
    const packages = (brief.packages ?? []).filter(
      (pkg) => pkg.sourceDocumentId !== documentId,
    );
    // Recompute from remaining insights only — do not keep the deleted
    // document's confidence when nothing is left.
    const confidence =
      documentInsights.length > 0
        ? Math.max(...documentInsights.map((insight) => insight.confidence))
        : 0;

    const hasBlueprint = await this.prisma.document.count({
      where: {
        projectId,
        status: DocumentStatus.uploaded,
        category: 'blueprint',
      },
    });

    const updatedBrief: ProjectBriefV1 = {
      ...brief,
      packages,
      design: {
        ...brief.design,
        hasPlans: hasBlueprint > 0,
      },
      ai: {
        ...brief.ai,
        documentInsights,
        confidence,
      },
    };

    const tagCount = await this.prisma.projectTag.count({
      where: { projectId },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        briefJson: updatedBrief as unknown as Prisma.InputJsonValue,
        readinessScore: computeReadinessScore({
          title: project.title,
          description: project.description,
          projectType: project.projectType,
          propertyType: project.propertyType,
          district: project.district,
          tagCount,
          brief: updatedBrief,
        }),
      },
    });
  }

  /**
   * Duplicate uploaded documents from one project card to another (new S3 keys).
   * When skipIfExists is true, skips files that already exist on the target
   * (matched by original name and size).
   */
  async copyDocumentsToProject(input: {
    sourceProjectId: string;
    targetProjectId: string;
    skipIfExists?: boolean;
  }): Promise<void> {
    const sourceDocs = await this.prisma.document.findMany({
      where: {
        projectId: input.sourceProjectId,
        status: DocumentStatus.uploaded,
      },
    });
    if (sourceDocs.length === 0) {
      return;
    }

    let existingKeys = new Set<string>();
    if (input.skipIfExists) {
      const targetDocs = await this.prisma.document.findMany({
        where: {
          projectId: input.targetProjectId,
          status: DocumentStatus.uploaded,
        },
        select: { originalName: true, sizeBytes: true },
      });
      existingKeys = new Set(
        targetDocs.map((doc) => `${doc.originalName}:${doc.sizeBytes ?? 0}`),
      );
    }

    if (!this.storage.isConfigured()) {
      return;
    }

    for (const doc of sourceDocs) {
      const dedupeKey = `${doc.originalName}:${doc.sizeBytes ?? 0}`;
      if (input.skipIfExists && existingKeys.has(dedupeKey)) {
        continue;
      }

      const documentId = randomUUID();
      const storageKey = buildStorageKey(
        input.targetProjectId,
        documentId,
        doc.originalName,
      );

      const body = await this.storage.getObjectBuffer(doc.storageKey);
      await this.storage.putObject({
        storageKey,
        body,
        contentType: doc.contentType,
      });

      let thumbnailStorageKey: string | null = null;
      if (doc.thumbnailStorageKey) {
        thumbnailStorageKey = buildDocumentThumbnailKey(
          input.targetProjectId,
          documentId,
        );
        const thumbBody = await this.storage.getObjectBuffer(
          doc.thumbnailStorageKey,
        );
        await this.storage.putObject({
          storageKey: thumbnailStorageKey,
          body: thumbBody,
          contentType: 'image/jpeg',
        });
      }

      await this.prisma.document.create({
        data: {
          id: documentId,
          projectId: input.targetProjectId,
          uploaderId: doc.uploaderId,
          originalName: doc.originalName,
          contentType: doc.contentType,
          sizeBytes: doc.sizeBytes,
          storageKey,
          thumbnailStorageKey,
          category: doc.category,
          status: DocumentStatus.uploaded,
          uploadedAt: doc.uploadedAt ?? new Date(),
        },
      });

      existingKeys.add(dedupeKey);
    }
  }
}
