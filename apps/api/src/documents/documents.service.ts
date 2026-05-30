import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Document, DocumentStatus } from '@prisma/client';
import { DocumentAnalysisService } from '../ai/document-analysis.service';
import { isPubliclyViewable } from '../projects/projects.constants';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  ALLOWED_CONTENT_TYPES,
  buildStorageKey,
  DocumentResponse,
  DownloadUrlResponse,
  MAX_UPLOAD_BYTES,
  PresignUploadDto,
  PresignUploadResponse,
} from './documents.types';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documentAnalysis: DocumentAnalysisService,
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
    if (!project || !isPubliclyViewable(project.status)) {
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

    return this.toResponse(updated);
  }

  async getDownloadUrl(
    projectId: string,
    documentId: string,
    userId: string,
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

    const presigned = await this.storage.createPresignedDownload(doc.storageKey);

    return {
      downloadUrl: presigned.downloadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
      originalName: doc.originalName,
      contentType: doc.contentType,
    };
  }

  async getPublicDownloadUrl(
    projectId: string,
    documentId: string,
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

    const presigned = await this.storage.createPresignedDownload(doc.storageKey);

    return {
      downloadUrl: presigned.downloadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
      originalName: doc.originalName,
      contentType: doc.contentType,
    };
  }
}
