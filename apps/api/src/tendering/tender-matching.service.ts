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

const MAX_TENDER_INVITATIONS = 8;

@Injectable()
export class TenderMatchingService {
  constructor(private readonly prisma: PrismaService) {}

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
      take: MAX_TENDER_INVITATIONS,
      select: { id: true },
    });

    return contractors.map((c) => c.id);
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
