import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BidStatus,
  ContractorProfile,
  ContractorVerificationStatus,
  DocumentStatus,
  Prisma,
  ProjectType,
  SupplyProfileKind,
} from '@prisma/client';
import { LocationsService } from '../locations/locations.service';
import type { ServiceLocation } from '../locations/locations.catalog';
import { PrismaService } from '../prisma/prisma.service';
import { requiredSupplyKindForProjectType } from '../projects/design-permits.utils';
import { StorageService } from '../storage/storage.service';
import {
  ContractorProfileResponse,
  UpsertContractorProfileDto,
} from './tendering.types';
import {
  isValidThaiTaxId,
  normalizePreferredContactMethods,
  normalizeThaiTaxId,
} from './contractor-contact.util';

export interface ClientContractorProfileDocument {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  category: string;
  uploadedAt: string | null;
}

export interface ClientContractorPortfolioItem {
  id: string;
  title: string;
  description: string | null;
  originalName: string;
  contentType: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
}

export interface ClientContractorProfileView {
  contractorId: string;
  companyName: string | null;
  phone: string | null;
  kind: string;
  regionCode: string;
  serviceLocations: ServiceLocation[];
  tagSlugs: string[];
  verificationStatus: string;
  portfolio: ClientContractorPortfolioItem[];
  documents: ClientContractorProfileDocument[];
}

@Injectable()
export class ContractorProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
    private readonly storage: StorageService,
  ) {}

  toResponse(profile: ContractorProfile): ContractorProfileResponse {
    const serviceLocations = this.parseServiceLocations(
      profile.serviceLocationsJson,
    );
    return {
      id: profile.id,
      userId: profile.userId,
      kind: profile.kind,
      companyName: profile.companyName,
      phone: profile.phone,
      taxId: profile.taxId,
      preferredContactMethods: normalizePreferredContactMethods(
        profile.preferredContactMethods,
      ),
      bankName: profile.bankName,
      bankAccount: profile.bankAccount,
      regionCode: profile.regionCode,
      serviceLocations,
      projectTypes: profile.projectTypes,
      tagSlugs: profile.tagSlugs,
      verificationStatus: profile.verificationStatus,
      verificationComment: profile.verificationComment,
      verificationRequestedAt:
        profile.verificationRequestedAt?.toISOString() ?? null,
      verificationReviewedAt:
        profile.verificationReviewedAt?.toISOString() ?? null,
      createdAt: profile.createdAt.toISOString(),
    };
  }

  parseServiceLocations(raw: Prisma.JsonValue): ServiceLocation[] {
    return this.locations.normalizeServiceLocations(raw);
  }

  private async normalizeTagSlugs(
    slugs: string[] | undefined,
  ): Promise<string[] | undefined> {
    if (slugs === undefined) {
      return undefined;
    }

    const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
    if (unique.length === 0) {
      return [];
    }

    const existing = await this.prisma.tag.findMany({
      where: { slug: { in: unique } },
      select: { slug: true },
    });
    const valid = new Set(existing.map((tag) => tag.slug));
    return unique.filter((slug) => valid.has(slug));
  }

  async getByUserId(userId: string): Promise<ContractorProfileResponse | null> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
    });
    return profile ? this.toResponse(profile) : null;
  }

  async requireByUserId(userId: string): Promise<ContractorProfile> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException(
        'Supply profile not found. Register as a contractor or designer first.',
      );
    }
    return profile;
  }

  assertKindForProject(
    profile: ContractorProfile,
    projectType: ProjectType,
  ): void {
    const required = requiredSupplyKindForProjectType(projectType);
    if (profile.kind !== required) {
      throw new ForbiddenException(
        required === SupplyProfileKind.designer
          ? 'Only designers may participate in Design & Permits tenders'
          : 'Only contractors may participate in construction tenders',
      );
    }
  }

  async upsertForUser(
    userId: string,
    dto: UpsertContractorProfileDto,
    options?: { kind?: SupplyProfileKind },
  ): Promise<ContractorProfileResponse> {
    const projectTypes =
      dto.projectTypes === undefined
        ? undefined
        : [...new Set(dto.projectTypes)];
    const tagSlugs = await this.normalizeTagSlugs(dto.tagSlugs);
    const serviceLocations = this.locations.normalizeServiceLocations(
      dto.serviceLocations,
    );
    const primaryRegion = this.locations.assertRegionSlug(
      serviceLocations[0].regionSlug,
    );

    const companyName = dto.companyName?.trim() || null;
    const phone =
      dto.phone === undefined ? undefined : dto.phone?.trim() || null;
    let taxId: string | null | undefined = undefined;
    if (dto.taxId !== undefined) {
      const normalized = normalizeThaiTaxId(dto.taxId);
      if (normalized && !isValidThaiTaxId(normalized)) {
        throw new BadRequestException('Tax ID must be exactly 13 digits');
      }
      taxId = normalized;
    }
    const preferredContactMethods =
      dto.preferredContactMethods === undefined
        ? undefined
        : normalizePreferredContactMethods(dto.preferredContactMethods);
    const bankName =
      dto.bankName === undefined ? undefined : dto.bankName?.trim() || null;
    const bankAccount =
      dto.bankAccount === undefined
        ? undefined
        : dto.bankAccount?.trim() || null;
    const kind =
      options?.kind ??
      (dto.kind === 'designer'
        ? SupplyProfileKind.designer
        : SupplyProfileKind.contractor);

    const profile = await this.prisma.contractorProfile.upsert({
      where: { userId },
      create: {
        userId,
        kind,
        companyName,
        phone: phone ?? null,
        taxId: taxId ?? null,
        preferredContactMethods: preferredContactMethods ?? [],
        bankName: bankName ?? null,
        bankAccount: bankAccount ?? null,
        regionCode: primaryRegion.countryCode,
        serviceLocationsJson:
          serviceLocations as unknown as Prisma.InputJsonValue,
        projectTypes: projectTypes ?? [],
        tagSlugs: tagSlugs ?? [],
        verificationStatus: ContractorVerificationStatus.pending,
      },
      update: {
        kind,
        companyName,
        ...(phone !== undefined ? { phone } : {}),
        ...(taxId !== undefined ? { taxId } : {}),
        ...(preferredContactMethods !== undefined
          ? { preferredContactMethods }
          : {}),
        ...(bankName !== undefined ? { bankName } : {}),
        ...(bankAccount !== undefined ? { bankAccount } : {}),
        regionCode: primaryRegion.countryCode,
        serviceLocationsJson:
          serviceLocations as unknown as Prisma.InputJsonValue,
        projectTypes: projectTypes ?? undefined,
        tagSlugs: tagSlugs ?? undefined,
      },
    });

    if (companyName) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { displayName: companyName },
      });
    }

    return this.toResponse(profile);
  }

  /**
   * Reserved for future business rules if some actions should be
   * restricted to verified contractors. Currently verification is optional.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  assertVerified(profile: ContractorProfile): void {
    // no-op — participation in tenders is allowed without verification
  }

  /**
   * Project owner viewing a bidder's full profile (portfolio photos +
   * verification/profile documents) while reviewing commercial proposals.
   */
  async getProfileForBidClient(
    clientUserId: string,
    projectId: string,
    bidId: string,
  ): Promise<ClientContractorProfileView> {
    const { contractorId, profile } = await this.assertClientMayViewBidProfile(
      clientUserId,
      projectId,
      bidId,
    );

    const [portfolioRows, documents] = await Promise.all([
      this.prisma.contractorPortfolioItem.findMany({
        where: {
          contractorId,
          status: DocumentStatus.uploaded,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.contractorVerificationDocument.findMany({
        where: {
          contractorId,
          status: DocumentStatus.uploaded,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const portfolio: ClientContractorPortfolioItem[] = await Promise.all(
      portfolioRows.map(async (item) => {
        let imageUrl: string | null = null;
        let thumbnailUrl: string | null = null;
        if (this.storage.isConfigured()) {
          try {
            const full = await this.storage.createPresignedDownload(
              item.storageKey,
            );
            imageUrl = full.downloadUrl;
            if (item.thumbnailStorageKey) {
              const thumb = await this.storage.createPresignedDownload(
                item.thumbnailStorageKey,
              );
              thumbnailUrl = thumb.downloadUrl;
            }
          } catch {
            // Leave URLs null when signing fails.
          }
        }
        return {
          id: item.id,
          title: item.title,
          description: item.description,
          originalName: item.originalName,
          contentType: item.contentType,
          imageUrl,
          thumbnailUrl,
          sortOrder: item.sortOrder,
        };
      }),
    );

    return {
      contractorId,
      companyName: profile.companyName,
      phone: profile.phone,
      kind: profile.kind,
      regionCode: profile.regionCode,
      serviceLocations: this.parseServiceLocations(profile.serviceLocationsJson),
      tagSlugs: profile.tagSlugs,
      verificationStatus: profile.verificationStatus,
      portfolio,
      documents: documents.map((doc) => ({
        id: doc.id,
        originalName: doc.originalName,
        contentType: doc.contentType,
        sizeBytes: doc.sizeBytes,
        category: doc.category,
        uploadedAt: doc.uploadedAt?.toISOString() ?? null,
      })),
    };
  }

  async getDocumentDownloadForBidClient(
    clientUserId: string,
    projectId: string,
    bidId: string,
    documentId: string,
  ): Promise<{
    downloadUrl: string;
    expiresInSeconds: number;
    originalName: string;
    contentType: string;
  }> {
    const { contractorId } = await this.assertClientMayViewBidProfile(
      clientUserId,
      projectId,
      bidId,
    );

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

  private async assertClientMayViewBidProfile(
    clientUserId: string,
    projectId: string,
    bidId: string,
  ): Promise<{ contractorId: string; profile: ContractorProfile }> {
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

    const profile = await this.prisma.contractorProfile.findUnique({
      where: { id: bid.contractorId },
    });
    if (!profile) {
      throw new NotFoundException('Contractor profile not found');
    }

    return { contractorId: bid.contractorId, profile };
  }
}
