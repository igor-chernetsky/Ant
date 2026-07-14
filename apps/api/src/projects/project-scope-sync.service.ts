import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  ProjectStatus,
  ProjectType,
  PropertyType,
  TagSource,
} from '@prisma/client';
import { OpenAiScopeSyncService } from '../ai/openai-scope-sync.service';
import { ScopeSyncFallbackService } from '../ai/scope-sync-fallback.service';
import { EstimatesService } from '../estimation/estimates.service';
import { ProjectLocalizationService } from '../localization/project-localization.service';
import { normalizeSourceLocale } from '../localization/locale.utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProjectBriefV1,
  buildInitialBrief,
  computeReadinessScore,
} from './project-brief';
import { reconcileAiTagSlugs } from './project-tag-reconciliation';
import { ScopeSyncUpdate } from './scope-sync.types';

@Injectable()
export class ProjectScopeSyncService {
  private readonly logger = new Logger(ProjectScopeSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiScopeSyncService,
    private readonly fallback: ScopeSyncFallbackService,
    private readonly estimatesService: EstimatesService,
    private readonly projectLocalization: ProjectLocalizationService,
  ) {}

  dispatch(projectId: string, update: ScopeSyncUpdate): void {
    void this.applyUpdate(projectId, update).catch((error) => {
      this.logger.warn(
        `Scope sync failed for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  async applyUpdate(projectId: string, update: ScopeSyncUpdate): Promise<void> {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { tags: { include: { tag: true } } },
      });
      if (!project) {
        return;
      }

      const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
      const tags = await this.prisma.tag.findMany({ select: { slug: true } });
      const availableTagSlugs = tags.map((tag) => tag.slug);

      let result =
        (await this.openAi.processScopeUpdate({
          title: project.title,
          description: project.description,
          scopeSummary: project.scopeSummary,
          projectType: project.projectType,
          propertyType: project.propertyType,
          district: project.district,
          brief,
          update,
          availableTagSlugs,
          locale: normalizeSourceLocale(project.sourceLocale),
        })) ?? this.fallback.processScopeUpdate({
          title: project.title,
          description: project.description,
          scopeSummary: project.scopeSummary,
          projectType: project.projectType,
          propertyType: project.propertyType,
          district: project.district,
          brief,
          update,
          availableTagSlugs,
          locale: normalizeSourceLocale(project.sourceLocale),
        });

      if (!result.applied) {
        return;
      }

      const narrative = [
        result.updatedDescription,
        result.updatedSummary,
        result.updatedScopeSummary,
        update.body,
      ].join(' ');
      const tagSlugs = reconcileAiTagSlugs({
        suggested: result.tagSlugs,
        previous: project.tags.map((row) => row.tag.slug),
        narrative,
        preserveTrades: (brief.packages ?? []).map((pkg) => pkg.trade),
        allowed: availableTagSlugs,
      });
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
          scopeSummary: result.updatedScopeSummary,
          briefJson: updatedBrief as unknown as Prisma.InputJsonValue,
          readinessScore,
        },
      });

      if (previousStatus === ProjectStatus.estimated) {
        await this.estimatesService.generateAndStore(project.id);
      } else {
        this.projectLocalization.scheduleWarmProjectTranslations(project.id);
      }
  }

  buildClarificationAnswerUpdate(input: {
    questionText: string;
    answerText: string;
    attachmentNames?: string[];
  }): ScopeSyncUpdate {
    const files =
      input.attachmentNames && input.attachmentNames.length > 0
        ? `\nAttached files: ${input.attachmentNames.join(', ')}`
        : '';
    return {
      source: 'clarification_answer',
      body: `Clarification question answered.\nQuestion: ${input.questionText}\nAnswer: ${input.answerText}${files}`,
    };
  }

  buildClarificationAttachmentUpdate(input: {
    questionText: string;
    answerText?: string | null;
    attachmentName: string;
  }): ScopeSyncUpdate {
    const answerPart = input.answerText?.trim()
      ? `\nCurrent answer: ${input.answerText.trim()}`
      : '';
    return {
      source: 'clarification_attachment',
      body: `Clarification attachment uploaded for question "${input.questionText}". File: ${input.attachmentName}.${answerPart}`,
    };
  }

  buildClientChatUpdate(message: string): ScopeSyncUpdate {
    return {
      source: 'client_chat',
      body: message.trim(),
    };
  }

  private async replaceAiTags(projectId: string, slugs: string[]) {
    await this.prisma.projectTag.deleteMany({
      where: { projectId, source: TagSource.ai },
    });
    if (slugs.length === 0) {
      return;
    }

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
}
