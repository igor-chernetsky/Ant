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
import { ProjectsService } from '../projects/projects.service';
import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

  async listForProject(
    clientId: string,
    projectId: string,
  ): Promise<AmendmentResponse[]> {
    await this.loadOwnedProject(clientId, projectId);
    const rows = await this.prisma.projectAmendment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toResponse(row));
  }

  async create(
    clientId: string,
    projectId: string,
    dto: CreateAmendmentDto,
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

    return this.toResponse(row);
  }

  async processPending(
    clientId: string,
    projectId: string,
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

    return this.processAmendmentRows(clientId, project, pending);
  }

  async processOne(
    clientId: string,
    projectId: string,
    amendmentId: string,
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

    return this.processAmendmentRows(clientId, project, [amendment]);
  }

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
    },
    rows: ProjectAmendment[],
  ): Promise<ProcessAmendmentsResult> {
    const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
    const tags = await this.prisma.tag.findMany({ select: { slug: true } });
    const availableTagSlugs = tags.map((t) => t.slug);

    const context = {
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      propertyType: project.propertyType,
      district: project.district,
      brief,
      amendments: rows.map((row) => ({
        body: row.body,
        changeType: row.changeType,
        createdAt: row.createdAt.toISOString(),
      })),
      availableTagSlugs,
    };

    let result: AmendmentAiResult | null = null;
    if (this.openAi.isConfigured()) {
      result = await this.openAi.processAmendments(context);
    }
    if (!result) {
      result = this.fallback.processAmendments(context);
    }

    const tagSlugs = this.filterTagSlugs(result.tagSlugs, availableTagSlugs);
    await this.replaceAiTags(project.id, tagSlugs);

    const updatedBrief = this.mergeBrief(project.briefJson, {
      summary: result.updatedSummary,
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
        improvedDescription: result.updatedDescription,
        confidence: result.confidence,
      },
    });

    const projectWithTags = await this.prisma.project.findUnique({
      where: { id: project.id },
      include: { tags: true },
    });

    const readinessScore = computeReadinessScore({
      title: project.title,
      description: result.updatedDescription,
      projectType: project.projectType as ProjectType,
      propertyType: project.propertyType as PropertyType | null,
      district: project.district,
      tagCount: projectWithTags?.tags.length ?? 0,
      brief: updatedBrief,
    });

    const previousStatus = project.status;

    await this.prisma.project.update({
      where: { id: project.id },
      data: {
        description: result.updatedDescription,
        briefJson: updatedBrief as unknown as Prisma.InputJsonValue,
        readinessScore,
      },
    });

    const now = new Date();
    await this.prisma.projectAmendment.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: {
        processedAt: now,
        aiResultJson: result as unknown as Prisma.InputJsonValue,
      },
    });

    if (previousStatus === ProjectStatus.estimated) {
      await this.estimatesService.generateAndStore(project.id);
    }

    const updatedRows = await this.prisma.projectAmendment.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      orderBy: { createdAt: 'asc' },
    });

    const projectResponse = await this.projectsService.getForClient(
      clientId,
      project.id,
    );

    return {
      project: projectResponse,
      processedCount: rows.length,
      amendments: updatedRows.map((row) => this.toResponse(row)),
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

  private filterTagSlugs(slugs: string[], allowed: string[]): string[] {
    const allowedSet = new Set(allowed);
    return [...new Set(slugs.filter((s) => allowedSet.has(s)))];
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
