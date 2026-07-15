import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Document,
  DocumentCategory,
  DocumentStatus,
  ProjectStatus,
  Prisma,
} from '@prisma/client';
import { DocumentAnalysisService } from '../ai/document-analysis.service';
import { isPubliclyViewable } from '../projects/projects.constants';
import {
  computeReadinessScore,
  ProjectBriefV1,
} from '../projects/project-brief';
import { PrismaService } from '../prisma/prisma.service';
import { ImageThumbnailService } from '../storage/image-thumbnail.service';
import { StorageService } from '../storage/storage.service';
import {
  ALLOWED_CONTENT_TYPES,
  buildDocumentThumbnailKey,
  buildStorageKey,
  DocumentDownloadVariant,
  DocumentResponse,
  DownloadUrlResponse,
  inferDocumentCategory,
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

@Injectable()
export class DocumentsService {
  private readonly thumbnailJobs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documentAnalysis: DocumentAnalysisService,
    private readonly thumbnails: ImageThumbnailService,
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

  private async assertPublicProjectView(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || !isPubliclyViewable(project.status) || project.isHidden) {
      throw new NotFoundException('Project not found');
    }
    return project;
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
  ): Promise<DocumentResponse[]> {
    await this.assertProjectOwner(projectId, userId);

    const docs = await this.prisma.document.findMany({
      where: {
        projectId,
        status: { not: DocumentStatus.deleted },
      },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((doc) => this.toResponse(doc));
  }

  async listForPublicProject(projectId: string): Promise<DocumentResponse[]> {
    await this.assertPublicProjectView(projectId);

    const docs = await this.prisma.document.findMany({
      where: {
        projectId,
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
    await this.assertProjectOwner(projectId, userId);
    this.validateUploadInput(dto);

    const documentId = randomUUID();
    const fileName = dto.fileName.trim();
    const contentType = dto.contentType.trim().toLowerCase();
    const storageKey = buildStorageKey(projectId, documentId, fileName);

    await this.prisma.document.create({
      data: {
        id: documentId,
        projectId,
        uploaderId: userId,
        originalName: fileName,
        contentType,
        sizeBytes: dto.sizeBytes,
        storageKey,
        category: dto.category ?? 'other',
        status: DocumentStatus.pending,
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
    await this.assertProjectOwner(projectId, userId);

    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    if (doc.status === DocumentStatus.uploaded) {
      this.scheduleThumbnailGeneration(doc);
      return this.toResponse(doc);
    }

    if (doc.status === DocumentStatus.deleted) {
      throw new BadRequestException('Document was deleted');
    }

    const { sizeBytes } = await this.storage.verifyObject(doc.storageKey);

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.uploaded,
        sizeBytes,
        uploadedAt: new Date(),
      },
    });

    this.documentAnalysis.scheduleAnalysis(projectId, documentId);
    this.scheduleThumbnailGeneration(updated);

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
  ): Promise<DownloadUrlResponse> {
    await this.assertProjectOwner(projectId, userId);

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
  ): Promise<DownloadUrlResponse> {
    await this.assertPublicProjectView(projectId);

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
    const confidence =
      documentInsights.length > 0
        ? Math.max(...documentInsights.map((insight) => insight.confidence))
        : (brief.ai?.confidence ?? 0);

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
}
