import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProjectAmendment,
  ProjectStatus,
  ProjectType,
  PropertyType,
  TagSource,
} from '@prisma/client';
import { AmendmentFallbackService } from '../ai/amendment-fallback.service';
import { AmendmentAiResult } from '../ai/amendment.types';
import { OpenAiAmendmentService } from '../ai/openai-amendment.service';
import { EstimatesService } from '../estimation/estimates.service';
import {
  ProjectBriefV1,
  buildInitialBrief,
  computeReadinessScore,
} from '../projects/project-brief';
import { reconcileAiTagSlugs } from '../projects/project-tag-reconciliation';
import {
  preserveMergedDescription,
  preserveMergedSummary,
} from '../projects/scope-sync-preserve';
import { ProjectsService } from '../projects/projects.service';
import { ProjectLocalizationService } from '../localization/project-localization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SupportedLocale } from '../users/locale.types';
import { isAmendableStatus } from './amendments.constants';
import {
  AmendmentResponse,
  CreateAmendmentDto,
  ProcessAmendmentsResult,
} from './amendments.types';

@Injectable()
export class AmendmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiAmendmentService,
    private readonly fallback: AmendmentFallbackService,
    private readonly projectsService: ProjectsService,
    private readonly estimatesService: EstimatesService,
    private readonly projectLocalization: ProjectLocalizationService,
  ) {}

  async listForProject(
    clientId: string,
    projectId: string,
    viewerLocale?: SupportedLocale,
  ): Promise<AmendmentResponse[]> {
    await this.loadOwnedProject(clientId, projectId);
    const rows = await this.prisma.projectAmendment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    const amendments = rows.map((row) => this.toResponse(row));
    if (!viewerLocale) {
      return amendments;
    }
    return this.projectLocalization.localizeAmendments(
      projectId,
      amendments,
      viewerLocale,
    );
  }

  async create(
    clientId: string,
    projectId: string,
    dto: CreateAmendmentDto,
    viewerLocale?: SupportedLocale,
  ): Promise<AmendmentResponse> {
    const project = await this.loadOwnedProject(clientId, projectId);
    this.assertAmendable(project.status);

    const body = dto.body?.trim();
    if (!body || body.length < 5) {
      throw new BadRequestException(
        'Amendment must be at least 5 characters',
      );
    }

    const row = await this.prisma.projectAmendment.create({
      data: {
        projectId,
        body,
        changeType: dto.changeType ?? null,
      },
    });

    const amendment = this.toResponse(row);
    if (!viewerLocale) {
      return amendment;
    }
    const [localized] = await this.projectLocalization.localizeAmendments(
      projectId,
      [amendment],
      viewerLocale,
    );
    return localized;
  }

  async processPending(
    clientId: string,
    projectId: string,
    viewerLocale?: SupportedLocale,
  ): Promise<ProcessAmendmentsResult> {
    const project = await this.loadOwnedProject(clientId, projectId);
    this.assertAmendable(project.status);

    const pending = await this.prisma.projectAmendment.findMany({
      where: { projectId, processedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    if (pending.length === 0) {
      throw new BadRequestException('No pending amendments to process');
    }

    return this.processAmendmentRows(clientId, project, pending, viewerLocale);
  }

  async processOne(
    clientId: string,
    projectId: string,
    amendmentId: string,
    viewerLocale?: SupportedLocale,
  ): Promise<ProcessAmendmentsResult> {
    const project = await this.loadOwnedProject(clientId, projectId);
    this.assertAmendable(project.status);

    const amendment = await this.prisma.projectAmendment.findFirst({
      where: { id: amendmentId, projectId },
    });
    if (!amendment) {
      throw new NotFoundException('Amendment not found');
    }
    if (amendment.processedAt) {
      throw new BadRequestException('Amendment already processed');
    }

    return this.processAmendmentRows(clientId, project, [amendment], viewerLocale);
  }

  /**
   * Apply pending amendments one-by-one in chronological order.
   * Each step sees the updated description/brief from the previous step so
   * later instructions (remove X, then add X) win without batch contradictions.
   */
  private async processAmendmentRows(
    clientId: string,
    project: {
      id: string;
      title: string;
      description: string | null;
      projectType: string;
      propertyType: string | null;
      district: string | null;
      status: ProjectStatus;
      briefJson: unknown;
      sourceLocale?: string | null;
    },
    rows: ProjectAmendment[],
    viewerLocale?: SupportedLocale,
  ): Promise<ProcessAmendmentsResult> {
    const sorted = [...rows].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const tags = await this.prisma.tag.findMany({ select: { slug: true } });
    const availableTagSlugs = tags.map((t) => t.slug);

    let description = project.description;
    let brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
    const previousStatus = project.status;

    const previousTagRows = await this.prisma.projectTag.findMany({
      where: { projectId: project.id },
      include: { tag: true },
    });
    let currentTagSlugs = previousTagRows.map((row) => row.tag.slug);

    for (const row of sorted) {
      const context = {
        title: project.title,
        description,
        projectType: project.projectType,
        propertyType: project.propertyType,
        district: project.district,
        brief,
        amendments: [
          {
            body: row.body,
            changeType: row.changeType,
            createdAt: row.createdAt.toISOString(),
          },
        ],
        availableTagSlugs,
        locale: project.sourceLocale ?? undefined,
      };

      let result: AmendmentAiResult | null = null;
      if (this.openAi.isConfigured()) {
        result = await this.openAi.processAmendments(context);
      }
      if (!result) {
        result = this.fallback.processAmendments(context);
      }

      const updateBody = row.body;
      const updatedDescription = preserveMergedDescription({
        previousDescription: description,
        previousSummary: brief.summary,
        candidate: result.updatedDescription,
        updateBody,
      });
      const updatedSummary = preserveMergedSummary({
        previousSummary: brief.summary,
        previousDescription: description,
        candidate: result.updatedSummary,
        preservedDescription: updatedDescription,
      });

      const tagSlugs = reconcileAiTagSlugs({
        suggested: result.tagSlugs,
        previous: currentTagSlugs,
        narrative: [updatedDescription, updatedSummary, updateBody].join(' '),
        preserveTrades: (brief.packages ?? []).map((pkg) => pkg.trade),
        allowed: availableTagSlugs,
      });
      await this.replaceAiTags(project.id, tagSlugs);
      currentTagSlugs = tagSlugs;

      brief = this.mergeBrief(brief, {
        summary: updatedSummary,
        constraints: result.briefPatches?.constraints ?? brief.constraints,
        property: result.briefPatches?.property
          ? { ...brief.property, ...result.briefPatches.property }
          : brief.property,
        timeline: result.briefPatches?.timeline
          ? { ...brief.timeline, ...result.briefPatches.timeline }
          : brief.timeline,
        materials: result.briefPatches?.materials
          ? { ...brief.materials, ...result.briefPatches.materials }
          : brief.materials,
        ai: {
          ...brief.ai,
          improvedDescription: updatedDescription,
          confidence: result.confidence,
        },
      });
      description = updatedDescription;

      const tagCount = await this.prisma.projectTag.count({
        where: { projectId: project.id },
      });
      const readinessScore = computeReadinessScore({
        title: project.title,
        description,
        projectType: project.projectType as ProjectType,
        propertyType: project.propertyType as PropertyType | null,
        district: project.district,
        tagCount,
        brief,
      });

      await this.prisma.project.update({
        where: { id: project.id },
        data: {
          description,
          briefJson: brief as unknown as Prisma.InputJsonValue,
          readinessScore,
        },
      });

      await this.prisma.projectAmendment.update({
        where: { id: row.id },
        data: {
          processedAt: new Date(),
          aiResultJson: result as unknown as Prisma.InputJsonValue,
        },
      });
    }

    if (previousStatus === ProjectStatus.estimated) {
      await this.estimatesService.generateAndStore(project.id);
    } else {
      this.projectLocalization.scheduleWarmProjectTranslations(project.id);
    }

    const updatedRows = await this.prisma.projectAmendment.findMany({
      where: { id: { in: sorted.map((r) => r.id) } },
      orderBy: { createdAt: 'asc' },
    });

    const projectResponse = await this.projectsService.getForClient(
      clientId,
      project.id,
      viewerLocale,
    );

    const amendments = updatedRows.map((row) => this.toResponse(row));
    const localizedAmendments = viewerLocale
      ? await this.projectLocalization.localizeAmendments(
          project.id,
          amendments,
          viewerLocale,
        )
      : amendments;

    return {
      project: projectResponse,
      processedCount: sorted.length,
      amendments: localizedAmendments,
    };
  }

  private async loadOwnedProject(clientId: string, projectId: string) {
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

  private assertAmendable(status: ProjectStatus) {
    if (!isAmendableStatus(status)) {
      throw new BadRequestException(
        'Project scope is locked while tendering is active',
      );
    }
  }

  private async replaceAiTags(projectId: string, slugs: string[]) {
    await this.prisma.projectTag.deleteMany({
      where: { projectId, source: TagSource.ai },
    });

    if (slugs.length === 0) return;

    const tags = await this.prisma.tag.findMany({
      where: { slug: { in: slugs } },
    });

    await this.prisma.projectTag.createMany({
      data: tags.map((tag) => ({
        projectId,
        tagId: tag.id,
        source: TagSource.ai,
      })),
      skipDuplicates: true,
    });
  }

  private mergeBrief(
    existing: unknown,
    patch: Partial<ProjectBriefV1> & { ai?: ProjectBriefV1['ai'] },
  ): ProjectBriefV1 {
    const base =
      existing && typeof existing === 'object'
        ? (existing as ProjectBriefV1)
        : buildInitialBrief({});

    return {
      ...base,
      ...patch,
      property: patch.property ?? base.property,
      timeline: patch.timeline ?? base.timeline,
      materials: patch.materials ?? base.materials,
      ai: {
        ...base.ai,
        ...patch.ai,
        intake: patch.ai?.intake ?? base.ai?.intake,
      },
    };
  }

  private toResponse(row: ProjectAmendment): AmendmentResponse {
    return {
      id: row.id,
      projectId: row.projectId,
      body: row.body,
      changeType: row.changeType,
      createdAt: row.createdAt.toISOString(),
      processedAt: row.processedAt?.toISOString() ?? null,
      aiResult: row.aiResultJson
        ? (row.aiResultJson as unknown as AmendmentAiResult)
        : null,
    };
  }
}
