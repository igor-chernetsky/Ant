import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractorProfile,
  ContractorVerificationStatus,
  ProjectType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContractorProfileResponse,
  UpsertContractorProfileDto,
} from './tendering.types';

@Injectable()
export class ContractorProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  toResponse(profile: ContractorProfile): ContractorProfileResponse {
    return {
      id: profile.id,
      userId: profile.userId,
      companyName: profile.companyName,
      regionCode: profile.regionCode,
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
        'Contractor profile not found. Register as a contractor first.',
      );
    }
    return profile;
  }

  async upsertForUser(
    userId: string,
    dto: UpsertContractorProfileDto,
  ): Promise<ContractorProfileResponse> {
    const projectTypes = dto.projectTypes?.length
      ? [...new Set(dto.projectTypes)]
      : undefined;
    const tagSlugs = await this.normalizeTagSlugs(dto.tagSlugs);

    const profile = await this.prisma.contractorProfile.upsert({
      where: { userId },
      create: {
        userId,
        companyName: dto.companyName?.trim() || null,
        regionCode: dto.regionCode?.trim() || 'TH',
        projectTypes: projectTypes ?? [],
        tagSlugs: tagSlugs ?? [],
        verificationStatus: ContractorVerificationStatus.pending,
      },
      update: {
        companyName: dto.companyName?.trim() || null,
        regionCode: dto.regionCode?.trim() || undefined,
        projectTypes: projectTypes ?? undefined,
        tagSlugs: tagSlugs ?? undefined,
      },
    });

    return this.toResponse(profile);
  }

  assertVerified(profile: ContractorProfile): void {
    if (profile.verificationStatus !== ContractorVerificationStatus.verified) {
      throw new ForbiddenException(
        'Contractor account must be verified before participating in tenders',
      );
    }
  }
}
