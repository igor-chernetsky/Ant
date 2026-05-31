import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractorVerificationStatus,
  DocumentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ContractorProfilesService } from '../tendering/contractor-profiles.service';
import {
  AdminContractorDetail,
  AdminContractorListItem,
  ContractorVerificationDocumentResponse,
  RejectContractorDto,
} from './verification.types';

@Injectable()
export class AdminContractorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly contractorProfiles: ContractorProfilesService,
  ) {}

  private toDocResponse(
    doc: Prisma.ContractorVerificationDocumentGetPayload<object>,
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

  async listContractors(
    status?: ContractorVerificationStatus,
  ): Promise<AdminContractorListItem[]> {
    const profiles = await this.prisma.contractorProfile.findMany({
      where: status ? { verificationStatus: status } : undefined,
      include: {
        user: true,
        _count: {
          select: {
            verificationDocuments: {
              where: { status: DocumentStatus.uploaded },
            },
          },
        },
      },
      orderBy: [
        { verificationRequestedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      email: p.user.email,
      displayName: p.user.displayName,
      companyName: p.companyName,
      regionCode: p.regionCode,
      verificationStatus: p.verificationStatus,
      verificationRequestedAt: p.verificationRequestedAt?.toISOString() ?? null,
      verificationReviewedAt: p.verificationReviewedAt?.toISOString() ?? null,
      verificationComment: p.verificationComment,
      documentCount: p._count.verificationDocuments,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async getContractor(contractorId: string): Promise<AdminContractorDetail> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { id: contractorId },
      include: {
        user: true,
        verificationDocuments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!profile) {
      throw new NotFoundException('Contractor not found');
    }

    return {
      id: profile.id,
      userId: profile.userId,
      email: profile.user.email,
      displayName: profile.user.displayName,
      companyName: profile.companyName,
      regionCode: profile.regionCode,
      projectTypes: profile.projectTypes,
      verificationStatus: profile.verificationStatus,
      verificationRequestedAt: profile.verificationRequestedAt?.toISOString() ?? null,
      verificationReviewedAt: profile.verificationReviewedAt?.toISOString() ?? null,
      verificationComment: profile.verificationComment,
      documentCount: profile.verificationDocuments.filter(
        (d) => d.status === DocumentStatus.uploaded,
      ).length,
      createdAt: profile.createdAt.toISOString(),
      documents: profile.verificationDocuments.map((d) => this.toDocResponse(d)),
    };
  }

  async approveContractor(adminUserId: string, contractorId: string) {
    const profile = await this.requireAwaitingReview(contractorId);
    const updated = await this.prisma.contractorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: ContractorVerificationStatus.verified,
        verificationReviewedAt: new Date(),
        verificationComment: null,
        reviewedById: adminUserId,
      },
    });
    return this.contractorProfiles.toResponse(updated);
  }

  async rejectContractor(
    adminUserId: string,
    contractorId: string,
    dto: RejectContractorDto,
  ) {
    const comment = dto.comment?.trim();
    if (!comment || comment.length < 3) {
      throw new BadRequestException('Rejection comment is required');
    }

    const profile = await this.requireAwaitingReview(contractorId);
    const updated = await this.prisma.contractorProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: ContractorVerificationStatus.rejected,
        verificationReviewedAt: new Date(),
        verificationComment: comment,
        reviewedById: adminUserId,
      },
    });
    return this.contractorProfiles.toResponse(updated);
  }

  async getDocumentDownloadUrl(contractorId: string, documentId: string) {
    const doc = await this.prisma.contractorVerificationDocument.findFirst({
      where: {
        id: documentId,
        contractorId,
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

  private async requireAwaitingReview(contractorId: string) {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { id: contractorId },
    });
    if (!profile) {
      throw new NotFoundException('Contractor not found');
    }
    if (
      profile.verificationStatus !== ContractorVerificationStatus.awaiting_review
    ) {
      throw new BadRequestException(
        'Contractor is not awaiting verification review',
      );
    }
    return profile;
  }
}
