import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ContractorVerificationDocCategory,
  ContractorVerificationStatus,
  DocumentStatus,
} from '@prisma/client';
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
} from '../documents/documents.types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ContractorProfilesService } from '../tendering/contractor-profiles.service';
import {
  buildContractorDocStorageKey,
  ContractorVerificationDocumentResponse,
  PresignContractorDocDto,
} from './verification.types';

@Injectable()
export class ContractorVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly contractorProfiles: ContractorProfilesService,
  ) {}

  private toDocResponse(
    doc: {
      id: string;
      contractorId: string;
      originalName: string;
      contentType: string;
      sizeBytes: number | null;
      category: ContractorVerificationDocCategory;
      status: DocumentStatus;
      createdAt: Date;
      uploadedAt: Date | null;
    },
  ): ContractorVerificationDocumentResponse {
    return {
      id: doc.id,
      contractorId: doc.contractorId,
      originalName: doc.originalName,
      contentType: doc.contentType,
      sizeBytes: doc.sizeBytes,
      category: doc.category,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
      uploadedAt: doc.uploadedAt?.toISOString() ?? null,
    };
  }

  private assertCanUploadDocuments(status: ContractorVerificationStatus) {
    if (status === ContractorVerificationStatus.awaiting_review) {
      throw new BadRequestException(
        'Documents cannot be added while verification is in review',
      );
    }
    if (status === ContractorVerificationStatus.suspended) {
      throw new BadRequestException(
        'Documents cannot be added while your account is suspended',
      );
    }
  }

  async listDocuments(userId: string): Promise<ContractorVerificationDocumentResponse[]> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const docs = await this.prisma.contractorVerificationDocument.findMany({
      where: {
        contractorId: profile.id,
        status: { not: DocumentStatus.deleted },
      },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => this.toDocResponse(d));
  }

  async presignUpload(userId: string, dto: PresignContractorDocDto) {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    this.assertCanUploadDocuments(profile.verificationStatus);

    const fileName = dto.fileName?.trim();
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }
    const contentType = dto.contentType?.trim().toLowerCase();
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException('Unsupported content type');
    }
    if (
      !Number.isFinite(dto.sizeBytes) ||
      dto.sizeBytes < 1 ||
      dto.sizeBytes > MAX_UPLOAD_BYTES
    ) {
      throw new BadRequestException('Invalid file size');
    }

    const documentId = randomUUID();
    const storageKey = buildContractorDocStorageKey(
      profile.id,
      documentId,
      fileName,
    );

    await this.prisma.contractorVerificationDocument.create({
      data: {
        id: documentId,
        contractorId: profile.id,
        uploaderId: userId,
        originalName: fileName,
        contentType,
        sizeBytes: dto.sizeBytes,
        storageKey,
        category: dto.category ?? ContractorVerificationDocCategory.other,
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

  async completeUpload(userId: string, documentId: string) {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    this.assertCanUploadDocuments(profile.verificationStatus);

    const doc = await this.prisma.contractorVerificationDocument.findFirst({
      where: { id: documentId, contractorId: profile.id },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    if (doc.status === DocumentStatus.uploaded) {
      return this.toDocResponse(doc);
    }

    const { sizeBytes } = await this.storage.verifyObject(doc.storageKey);
    const updated = await this.prisma.contractorVerificationDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.uploaded,
        sizeBytes,
        uploadedAt: new Date(),
      },
    });
    return this.toDocResponse(updated);
  }

  async getDownloadUrl(userId: string, documentId: string) {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const doc = await this.prisma.contractorVerificationDocument.findFirst({
      where: {
        id: documentId,
        contractorId: profile.id,
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

  async requestApproval(userId: string) {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    if (
      profile.verificationStatus !== ContractorVerificationStatus.pending &&
      profile.verificationStatus !== ContractorVerificationStatus.rejected
    ) {
      throw new BadRequestException(
        'Verification can only be requested from pending or rejected status',
      );
    }

    const docCount = await this.prisma.contractorVerificationDocument.count({
      where: {
        contractorId: profile.id,
        status: DocumentStatus.uploaded,
      },
    });
    if (docCount < 1) {
      throw new BadRequestException(
        'Upload at least one verification document before requesting approval',
      );
    }

    const updated = await this.prisma.contractorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: ContractorVerificationStatus.awaiting_review,
        verificationRequestedAt: new Date(),
        verificationComment: null,
      },
    });

    return this.contractorProfiles.toResponse(updated);
  }
}
