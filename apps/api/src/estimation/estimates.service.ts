import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus, ProjectType, PropertyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeSourceLocale } from '../localization/locale.utils';
import { ProjectBriefV1 } from '../projects/project-brief';
import { buildDesignFeeEstimate } from '../projects/design-fee-estimate';
import { BallparkEstimateService } from './ballpark-estimate.service';
import { ProjectLocalizationService } from '../localization/project-localization.service';
import { EstimateLine, EstimateResponse, EstimateTotals } from './estimates.types';

@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ballpark: BallparkEstimateService,
    private readonly projectLocalization: ProjectLocalizationService,
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
        tender: {
          select: {
            clarificationQuestions: {
              where: { answer: { not: null } },
              select: { questionText: true, answer: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
    const tagSlugs = project.tags.map((pt) => pt.tag.slug);
    const clarificationQa = (project.tender?.clarificationQuestions ?? [])
      .filter((row) => row.answer?.trim())
      .map((row) => ({
        question: row.questionText,
        answer: row.answer!.trim(),
      }));

    const previousEstimate = await this.prisma.estimate.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    const previousLines = Array.isArray(previousEstimate?.linesJson)
      ? (previousEstimate.linesJson as unknown as EstimateLine[])
      : [];

    // Always generate the construction-style ballpark first (same algorithm).
    const result = await this.ballpark.generate({
      title: project.title,
      description: project.description,
      projectType:
        project.projectType === ProjectType.design
          ? ProjectType.new_build
          : project.projectType,
      propertyType: project.propertyType,
      district: project.district,
      regionCode: project.regionCode,
      tagSlugs,
      brief,
      locale: normalizeSourceLocale(project.sourceLocale),
      previousLines:
        project.projectType === ProjectType.design ? [] : previousLines,
      clarificationQa,
      clarificationSummary: project.clarificationSummary,
      scopeSummary: project.scopeSummary,
    });

    let lines = result.lines;
    let totals = result.totals;
    let disclaimer = result.disclaimer;
    let designFeePercent: number | null = null;
    let baseConstructionTotals: EstimateTotals | null = null;

    if (project.projectType === ProjectType.design) {
      const design = buildDesignFeeEstimate({
        lines: result.lines,
        totals: result.totals,
        propertyType: project.propertyType,
        tagSlugs,
        disclaimer: result.disclaimer,
      });
      lines = design.lines;
      totals = design.totals;
      disclaimer = design.disclaimer;
      designFeePercent = design.percent;
      baseConstructionTotals = design.baseTotals;
    }

    const record = await this.prisma.estimate.create({
      data: {
        projectId,
        type: 'ballpark',
        currency: totals.currency,
        totalsJson: totals as unknown as Prisma.InputJsonValue,
        linesJson: lines as unknown as Prisma.InputJsonValue,
        confidence: result.confidence,
        disclaimer,
      },
    });

    if (designFeePercent != null && baseConstructionTotals) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          designFeePercent,
          baseConstructionTotalsJson:
            baseConstructionTotals as unknown as Prisma.InputJsonValue,
        },
      });
    }

    // Do not pull in-tender / later projects back to "estimated".
    if (
      project.status === ProjectStatus.draft ||
      project.status === ProjectStatus.intake ||
      project.status === ProjectStatus.ready_for_estimate ||
      project.status === ProjectStatus.estimated
    ) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.estimated },
      });
    }

    this.projectLocalization.scheduleWarmProjectTranslations(projectId);

    return this.toResponse(record);
  }

  /**
   * Convert an existing construction estimate into a design-fee estimate
   * on the same project (used by convert-to-design).
   */
  async applyDesignFeeFromExisting(
    projectId: string,
    propertyType: PropertyType | null,
    tagSlugs: string[],
  ): Promise<{
    estimate: EstimateResponse;
    percent: number;
    baseTotals: EstimateTotals;
  }> {
    const previous = await this.prisma.estimate.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (!previous) {
      throw new NotFoundException('No estimate to convert');
    }

    const baseLines = previous.linesJson as unknown as EstimateLine[];
    const baseTotals = previous.totalsJson as unknown as EstimateTotals;
    const design = buildDesignFeeEstimate({
      lines: baseLines,
      totals: baseTotals,
      propertyType,
      tagSlugs,
    });

    const record = await this.prisma.estimate.create({
      data: {
        projectId,
        type: 'ballpark',
        currency: design.totals.currency,
        totalsJson: design.totals as unknown as Prisma.InputJsonValue,
        linesJson: design.lines as unknown as Prisma.InputJsonValue,
        confidence: previous.confidence,
        disclaimer: design.disclaimer,
      },
    });

    return {
      estimate: this.toResponse(record),
      percent: design.percent,
      baseTotals: design.baseTotals,
    };
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
