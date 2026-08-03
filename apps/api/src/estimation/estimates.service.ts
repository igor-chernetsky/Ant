import {
  BadRequestException,
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
import { filterImprovementQuestionsAgainstAnswers } from './estimate-scope.utils';
import { adjustEstimateConfidence } from './estimate-confidence';
import {
  EstimateLine,
  EstimateMeta,
  EstimateRefinementAnswer,
  EstimateResponse,
  EstimateTotals,
} from './estimates.types';

const REFINE_ALLOWED_STATUSES: ProjectStatus[] = [
  ProjectStatus.ready_for_estimate,
  ProjectStatus.estimated,
];

function parseRefinementQa(raw: unknown): EstimateRefinementAnswer[] {
  if (!Array.isArray(raw)) return [];
  const out: EstimateRefinementAnswer[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const question =
      typeof (row as { question?: unknown }).question === 'string'
        ? (row as { question: string }).question.trim()
        : '';
    const answer =
      typeof (row as { answer?: unknown }).answer === 'string'
        ? (row as { answer: string }).answer.trim()
        : '';
    if (!question || !answer) continue;
    const answeredAt =
      typeof (row as { answeredAt?: unknown }).answeredAt === 'string'
        ? (row as { answeredAt: string }).answeredAt
        : new Date().toISOString();
    out.push({ question, answer, answeredAt });
  }
  return out;
}

function parseEstimateMeta(raw: unknown): EstimateMeta {
  if (!raw || typeof raw !== 'object') {
    return { improvementQuestions: [] };
  }
  const questions = (raw as { improvementQuestions?: unknown })
    .improvementQuestions;
  if (!Array.isArray(questions)) {
    return { improvementQuestions: [] };
  }
  return {
    improvementQuestions: questions
      .filter((q): q is string => typeof q === 'string')
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, 5),
  };
}

@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ballpark: BallparkEstimateService,
    private readonly projectLocalization: ProjectLocalizationService,
  ) {}

  refinementAnswersFrom(raw: unknown): EstimateRefinementAnswer[] {
    return parseRefinementQa(raw);
  }

  toResponse(
    record: {
      id: string;
      projectId: string;
      type: string;
      currency: string;
      totalsJson: unknown;
      linesJson: unknown;
      confidence: number;
      disclaimer: string;
      metaJson?: unknown;
      createdAt: Date;
    },
    refinementAnswers: EstimateRefinementAnswer[] = [],
  ): EstimateResponse {
    const meta = parseEstimateMeta(record.metaJson);
    const improvementQuestions = filterImprovementQuestionsAgainstAnswers(
      meta.improvementQuestions,
      refinementAnswers.map((row) => row.question),
    );
    return {
      id: record.id,
      projectId: record.projectId,
      type: record.type,
      currency: record.currency,
      totals: record.totalsJson as EstimateResponse['totals'],
      lines: record.linesJson as EstimateResponse['lines'],
      confidence: adjustEstimateConfidence(record.confidence),
      disclaimer: record.disclaimer,
      improvementQuestions,
      refinementAnswers,
      createdAt: record.createdAt.toISOString(),
    };
  }

  /** Shared with home tiles so confidence matches project detail. */
  adjustStoredConfidence(confidence: number): number {
    return adjustEstimateConfidence(confidence);
  }

  async getLatestForProject(
    clientId: string,
    projectId: string,
    viewerLocale?: import('../users/locale.types').SupportedLocale,
  ): Promise<EstimateResponse | null> {
    const project = await this.assertProjectOwner(projectId, clientId);

    const estimate = await this.prisma.estimate.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const response = estimate
      ? this.toResponse(
          estimate,
          parseRefinementQa(project.estimateRefinementQaJson),
        )
      : null;

    return this.applyViewerLocale(project, response, viewerLocale);
  }

  async refineAndRegenerate(
    clientId: string,
    projectId: string,
    answers: Array<{
      question: string;
      answer: string;
      questionIndex?: number;
    }>,
    viewerLocale?: import('../users/locale.types').SupportedLocale,
  ): Promise<EstimateResponse> {
    const project = await this.assertProjectOwner(projectId, clientId);
    if (!REFINE_ALLOWED_STATUSES.includes(project.status)) {
      throw new BadRequestException(
        'Estimate refinement is only available before tendering starts',
      );
    }

    const latestEstimate = await this.prisma.estimate.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { metaJson: true },
    });
    const sourceQuestions = parseEstimateMeta(
      latestEstimate?.metaJson,
    ).improvementQuestions;

    const cleaned = answers
      .map((row) => {
        const answer = row.answer?.trim() ?? '';
        const index =
          typeof row.questionIndex === 'number' &&
          Number.isInteger(row.questionIndex)
            ? row.questionIndex
            : undefined;
        const sourceQuestion =
          index != null && index >= 0 && index < sourceQuestions.length
            ? sourceQuestions[index]
            : row.question?.trim() ?? '';
        return {
          question: sourceQuestion.slice(0, 280),
          answer: answer.slice(0, 4000),
        };
      })
      .filter((row) => row.question.length > 0 && row.answer.length > 0);

    if (cleaned.length === 0) {
      throw new BadRequestException('At least one answered question is required');
    }

    const existing = parseRefinementQa(project.estimateRefinementQaJson);
    const now = new Date().toISOString();
    const merged = [...existing];
    for (const row of cleaned) {
      const idx = merged.findIndex(
        (item) =>
          item.question.trim().toLowerCase() === row.question.toLowerCase(),
      );
      const next: EstimateRefinementAnswer = {
        question: row.question,
        answer: row.answer,
        answeredAt: now,
      };
      if (idx >= 0) {
        merged[idx] = next;
      } else {
        merged.push(next);
      }
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        estimateRefinementQaJson: merged as unknown as Prisma.InputJsonValue,
      },
    });

    const response = await this.generateAndStore(projectId);
    return (
      (await this.applyViewerLocale(project, response, viewerLocale)) ?? response
    );
  }

  private async applyViewerLocale(
    project: { id: string; sourceLocale?: string | null },
    estimate: EstimateResponse | null,
    viewerLocale?: import('../users/locale.types').SupportedLocale,
  ): Promise<EstimateResponse | null> {
    if (!estimate || !viewerLocale) {
      return estimate;
    }
    const sourceLocale = normalizeSourceLocale(project.sourceLocale);
    if (viewerLocale === sourceLocale) {
      return estimate;
    }
    return this.projectLocalization.localizeEstimateFields(
      project.id,
      estimate,
      viewerLocale,
    );
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
    const estimateRefinementQa = parseRefinementQa(
      project.estimateRefinementQaJson,
    ).map((row) => ({
      question: row.question,
      answer: row.answer,
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
      estimateRefinementQa,
      allowTinyLineShare: project.projectType === ProjectType.design,
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

    const meta: EstimateMeta = {
      improvementQuestions: result.improvementQuestions,
    };

    const record = await this.prisma.estimate.create({
      data: {
        projectId,
        type: 'ballpark',
        currency: totals.currency,
        totalsJson: totals as unknown as Prisma.InputJsonValue,
        linesJson: lines as unknown as Prisma.InputJsonValue,
        confidence: result.confidence,
        disclaimer,
        metaJson: meta as unknown as Prisma.InputJsonValue,
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

    return this.toResponse(
      record,
      parseRefinementQa(project.estimateRefinementQaJson),
    );
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

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { estimateRefinementQaJson: true },
    });

    const baseLines = previous.linesJson as unknown as EstimateLine[];
    const baseTotals = previous.totalsJson as unknown as EstimateTotals;
    const design = buildDesignFeeEstimate({
      lines: baseLines,
      totals: baseTotals,
      propertyType,
      tagSlugs,
    });

    const previousMeta = parseEstimateMeta(previous.metaJson);
    const record = await this.prisma.estimate.create({
      data: {
        projectId,
        type: 'ballpark',
        currency: design.totals.currency,
        totalsJson: design.totals as unknown as Prisma.InputJsonValue,
        linesJson: design.lines as unknown as Prisma.InputJsonValue,
        confidence: previous.confidence,
        disclaimer: design.disclaimer,
        metaJson: previousMeta as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      estimate: this.toResponse(
        record,
        parseRefinementQa(project?.estimateRefinementQaJson),
      ),
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
