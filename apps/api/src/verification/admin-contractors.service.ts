import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractorVerificationStatus,
  DocumentStatus,
  Prisma,
  SupplyProfileKind,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContractorProfilesService } from '../tendering/contractor-profiles.service';
import { normalizePreferredContactMethods } from '../tendering/contractor-contact.util';
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
    private readonly notifications: NotificationsService,
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
    includeNoProfile = false,
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

    const items = profiles.map((p) => this.toListItem(p));

    if (status !== ContractorVerificationStatus.pending || !includeNoProfile) {
      return items;
    }

    const usersWithoutProfile = await this.prisma.user.findMany({
      where: {
        keycloakRoles: { has: 'contractor' },
        contractorProfile: { is: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    const profileUserIds = new Set(profiles.map((profile) => profile.userId));
    const noProfileItems = usersWithoutProfile
      .filter((user) => !profileUserIds.has(user.id))
      .map((user) => this.toNoProfileListItem(user));

    return [...items, ...noProfileItems].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async getContractor(contractorId: string): Promise<AdminContractorDetail> {
    if (contractorId.startsWith('user:')) {
      return this.getContractorWithoutProfile(contractorId.slice('user:'.length));
    }

    const profile = await this.prisma.contractorProfile.findUnique({
      where: { id: contractorId },
      include: {
        user: true,
        verificationDocuments: {
          where: { status: { not: DocumentStatus.deleted } },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            verificationDocuments: {
              where: { status: DocumentStatus.uploaded },
            },
          },
        },
      },
    });
    if (!profile) {
      throw new NotFoundException('Contractor not found');
    }

    return {
      ...this.toListItem(profile),
      projectTypes: profile.projectTypes,
      tagSlugs: profile.tagSlugs,
      documents: profile.verificationDocuments.map((d) => this.toDocResponse(d)),
    };
  }

  private toListItem(
    p: Prisma.ContractorProfileGetPayload<{
      include: {
        user: true;
        _count: { select: { verificationDocuments: true } };
      };
    }>,
  ): AdminContractorListItem {
    return {
      id: p.id,
      userId: p.userId,
      email: p.user.email,
      displayName: p.user.displayName,
      companyName: p.companyName,
      phone: p.phone,
      taxId: p.taxId,
      preferredContactMethods: normalizePreferredContactMethods(
        p.preferredContactMethods,
      ),
      bankName: p.bankName,
      bankAccount: p.bankAccount,
      regionCode: p.regionCode,
      kind: p.kind,
      verificationStatus: p.verificationStatus,
      verificationRequestedAt: p.verificationRequestedAt?.toISOString() ?? null,
      verificationReviewedAt: p.verificationReviewedAt?.toISOString() ?? null,
      verificationComment: p.verificationComment,
      documentCount: p._count.verificationDocuments,
      createdAt: p.createdAt.toISOString(),
      hasProfile: true,
    };
  }

  private toNoProfileListItem(user: {
    id: string;
    email: string | null;
    displayName: string | null;
    createdAt: Date;
  }): AdminContractorListItem {
    return {
      id: `user:${user.id}`,
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      companyName: null,
      phone: null,
      taxId: null,
      preferredContactMethods: [],
      bankName: null,
      bankAccount: null,
      regionCode: null,
      kind: SupplyProfileKind.contractor,
      verificationStatus: 'no_profile',
      verificationRequestedAt: null,
      verificationReviewedAt: null,
      verificationComment: null,
      documentCount: 0,
      createdAt: user.createdAt.toISOString(),
      hasProfile: false,
    };
  }

  private async getContractorWithoutProfile(
    userId: string,
  ): Promise<AdminContractorDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { contractorProfile: true },
    });
    if (
      !user ||
      user.contractorProfile ||
      !user.keycloakRoles.includes('contractor')
    ) {
      throw new NotFoundException('Contractor not found');
    }

    return {
      ...this.toNoProfileListItem(user),
      projectTypes: [],
      tagSlugs: [],
      documents: [],
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

    this.notifications.dispatch(
      this.notifications.notifyContractorVerificationApproved({
        contractorUserId: profile.userId,
        companyName: profile.companyName,
      }),
    );

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

    this.notifications.dispatch(
      this.notifications.notifyContractorVerificationRejected({
        contractorUserId: profile.userId,
        companyName: profile.companyName,
        comment,
      }),
    );

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
