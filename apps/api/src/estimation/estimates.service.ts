import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeSourceLocale } from '../localization/locale.utils';
import { ProjectBriefV1 } from '../projects/project-brief';
import { BallparkEstimateService } from './ballpark-estimate.service';
import { EstimateResponse } from './estimates.types';

@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ballpark: BallparkEstimateService,
  ) {}

  toResponse(record: {
    id: string;
    projectId: string;
    type: string;
    currency: string;
    totalsJson: unknown;
    linesJson: unknown;
    confidence: number;
    disclaimer: string;
    createdAt: Date;
  }): EstimateResponse {
    return {
      id: record.id,
      projectId: record.projectId,
      type: record.type,
      currency: record.currency,
      totals: record.totalsJson as EstimateResponse['totals'],
      lines: record.linesJson as EstimateResponse['lines'],
      confidence: record.confidence,
      disclaimer: record.disclaimer,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async getLatestForProject(
    clientId: string,
    projectId: string,
  ): Promise<EstimateResponse | null> {
    await this.assertProjectOwner(projectId, clientId);

    const estimate = await this.prisma.estimate.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return estimate ? this.toResponse(estimate) : null;
  }

  async generateAndStore(projectId: string): Promise<EstimateResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tags: { include: { tag: true } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
    const tagSlugs = project.tags.map((pt) => pt.tag.slug);

    const result = await this.ballpark.generate({
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      propertyType: project.propertyType,
      district: project.district,
      regionCode: project.regionCode,
      tagSlugs,
      brief,
      locale: normalizeSourceLocale(project.sourceLocale),
    });

    const record = await this.prisma.estimate.create({
      data: {
        projectId,
        type: 'ballpark',
        currency: result.totals.currency,
        totalsJson: result.totals as unknown as Prisma.InputJsonValue,
        linesJson: result.lines as unknown as Prisma.InputJsonValue,
        confidence: result.confidence,
        disclaimer: result.disclaimer,
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.estimated },
    });

    return this.toResponse(record);
  }

  private async assertProjectOwner(projectId: string, clientId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    return project;
  }
}
