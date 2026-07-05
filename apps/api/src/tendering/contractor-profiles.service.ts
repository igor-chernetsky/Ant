import { Injectable, NotFoundException } from '@nestjs/common';
import { ContractorProfile, ContractorVerificationStatus, Prisma } from '@prisma/client';
import { LocationsService } from '../locations/locations.service';
import type { ServiceLocation } from '../locations/locations.catalog';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContractorProfileResponse,
  UpsertContractorProfileDto,
} from './tendering.types';

@Injectable()
export class ContractorProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
  ) {}

  toResponse(profile: ContractorProfile): ContractorProfileResponse {
    const serviceLocations = this.parseServiceLocations(
      profile.serviceLocationsJson,
    );
    return {
      id: profile.id,
      userId: profile.userId,
      companyName: profile.companyName,
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
    const serviceLocations = this.locations.normalizeServiceLocations(
      dto.serviceLocations,
    );
    const primaryRegion = this.locations.assertRegionSlug(
      serviceLocations[0].regionSlug,
    );

    const companyName = dto.companyName?.trim() || null;

    const profile = await this.prisma.contractorProfile.upsert({
      where: { userId },
      create: {
        userId,
        companyName,
        regionCode: primaryRegion.countryCode,
        serviceLocationsJson:
          serviceLocations as unknown as Prisma.InputJsonValue,
        projectTypes: projectTypes ?? [],
        tagSlugs: tagSlugs ?? [],
        verificationStatus: ContractorVerificationStatus.pending,
      },
      update: {
        companyName,
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
}
