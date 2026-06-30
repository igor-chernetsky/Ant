import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Project,
  ProjectStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { ContractorProfilesService } from './contractor-profiles.service';

const MAX_TENDER_INVITATIONS = 8;

@Injectable()
export class TenderMatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly locations: LocationsService,
  ) {}

  async findInvitees(project: Project, excludeUserId: string): Promise<string[]> {
    const contractors = await this.prisma.contractorProfile.findMany({
      where: {
        regionCode: project.regionCode,
        userId: { not: excludeUserId },
        OR: [
          { projectTypes: { isEmpty: true } },
          { projectTypes: { has: project.projectType } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, serviceLocationsJson: true },
    });

    const projectLocation = {
      regionSlug: project.locationRegionSlug,
      areaSlug: project.locationAreaSlug,
    };

    return contractors
      .filter((contractor) => {
        const serviceLocations = this.contractorProfiles.parseServiceLocations(
          contractor.serviceLocationsJson,
        );
        return this.locations.contractorMatchesProject(
          serviceLocations,
          projectLocation,
        );
      })
      .slice(0, MAX_TENDER_INVITATIONS)
      .map((c) => c.id);
  }

  assertProjectEligibleForTender(project: Project): void {
    const allowed: ProjectStatus[] = [
      ProjectStatus.estimated,
      ProjectStatus.in_tender,
    ];
    if (!allowed.includes(project.status)) {
      throw new BadRequestException(
        'Project must be estimated before starting a tender',
      );
    }
  }
}
