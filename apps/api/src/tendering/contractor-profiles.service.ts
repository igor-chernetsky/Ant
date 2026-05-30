import {
  BadRequestException,
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
      verificationStatus: profile.verificationStatus,
      createdAt: profile.createdAt.toISOString(),
    };
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

  /**
   * MVP: new profiles are auto-verified so tender matching works without admin UI.
   */
  async upsertForUser(
    userId: string,
    dto: UpsertContractorProfileDto,
  ): Promise<ContractorProfileResponse> {
    const projectTypes = dto.projectTypes?.length
      ? [...new Set(dto.projectTypes)]
      : undefined;

    const profile = await this.prisma.contractorProfile.upsert({
      where: { userId },
      create: {
        userId,
        companyName: dto.companyName?.trim() || null,
        regionCode: dto.regionCode?.trim() || 'TH',
        projectTypes: projectTypes ?? [],
        verificationStatus: ContractorVerificationStatus.verified,
      },
      update: {
        companyName: dto.companyName?.trim() || null,
        regionCode: dto.regionCode?.trim() || undefined,
        projectTypes: projectTypes ?? undefined,
      },
    });

    return this.toResponse(profile);
  }
}
