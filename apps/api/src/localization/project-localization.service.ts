import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { IntakeQuestion } from '../ai/intake.types';
import type { ProjectBriefV1 } from '../projects/project-brief';
import type { ProjectResponse } from '../projects/projects.types';
import type { EstimateResponse } from '../estimation/estimates.types';
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../users/locale.types';
import { ContentTranslationService } from './content-translation.service';
import { normalizeSourceLocale } from './locale.utils';
import { OpenAiTranslationService } from './openai-translation.service';

type TextField = {
  kind: 'text';
  fieldKey: string;
  sourceText: string;
};

type JsonField = {
  kind: 'json';
  fieldKey: string;
  sourceValue: unknown;
};

type TranslatableField = TextField | JsonField;

@Injectable()
export class ProjectLocalizationService implements OnModuleInit {
  private readonly logger = new Logger(ProjectLocalizationService.name);
  private readonly warmingProjects = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly translations: ContentTranslationService,
    private readonly openAi: OpenAiTranslationService,
  ) {}

  onModuleInit(): void {
    if (!this.openAi.isConfigured()) {
      return;
    }
    // Backfill titles for existing projects after the process is up.
    setTimeout(() => {
      void this.warmAllProjectTitles().catch((err) => {
        this.logger.warn(
          `Startup title warm failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }, 3_000);
  }

  scheduleWarmProjectTranslations(projectId: string): void {
    if (this.warmingProjects.has(projectId)) {
      return;
    }

    this.warmingProjects.add(projectId);
    void this.warmProjectTranslations(projectId)
      .catch((err) => {
        this.logger.warn(
          `Background translation warm failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      })
      .finally(() => {
        this.warmingProjects.delete(projectId);
      });
  }

  async warmProjectTranslations(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tags: { include: { tag: { include: { group: true } } } },
      },
    });
    if (!project) {
      return;
    }

    const estimateRecord = await this.prisma.estimate.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const estimate: EstimateResponse | null = estimateRecord
      ? {
          id: estimateRecord.id,
          projectId: estimateRecord.projectId,
          type: estimateRecord.type,
          currency: estimateRecord.currency,
          totals: estimateRecord.totalsJson as unknown as EstimateResponse['totals'],
          lines: estimateRecord.linesJson as unknown as EstimateResponse['lines'],
          confidence: estimateRecord.confidence,
          disclaimer: estimateRecord.disclaimer,
          createdAt: estimateRecord.createdAt.toISOString(),
        }
      : null;

    const response: ProjectResponse = {
      id: project.id,
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      propertyType: project.propertyType,
      district: project.district,
      locationRegionSlug: project.locationRegionSlug,
      locationAreaSlug: project.locationAreaSlug,
      locationNote: project.locationNote,
      regionCode: project.regionCode,
      status: project.status,
      isHidden: project.isHidden,
      readinessScore: project.readinessScore,
      brief: (project.briefJson ?? null) as ProjectBriefV1 | null,
      clarificationMode: project.clarificationMode,
      clarificationSummary: project.clarificationSummary,
      scopeSummary: project.scopeSummary,
      tags: project.tags.map((pt) => ({
        slug: pt.tag.slug,
        label: pt.tag.label,
        source: pt.source,
        groupSlug: pt.tag.group?.slug ?? null,
      })),
      estimate,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };

    const sourceLocale = normalizeSourceLocale(project.sourceLocale);
    const fields = collectTranslatableFields(response);
    const targetLocales = SUPPORTED_LOCALES.filter(
      (locale) => locale !== sourceLocale,
    );

    for (const targetLocale of targetLocales) {
      await Promise.all(
        fields.map((field) => this.warmField(field, projectId, sourceLocale, targetLocale)),
      );
    }
  }

  async warmFromResponse(
    response: ProjectResponse,
    sourceLocale: SupportedLocale,
  ): Promise<void> {
    const fields = collectTranslatableFields(response);
    const targetLocales = SUPPORTED_LOCALES.filter(
      (locale) => locale !== sourceLocale,
    );

    for (const targetLocale of targetLocales) {
      await Promise.all(
        fields.map((field) =>
          this.warmField(field, response.id, sourceLocale, targetLocale),
        ),
      );
    }
  }

  /** Backfill titles for all projects into every non-source locale. */
  async warmAllProjectTitles(): Promise<{ processed: number }> {
    if (!this.openAi.isConfigured()) {
      this.logger.warn('Skipping title warm: OPENAI_API_KEY is not configured');
      return { processed: 0 };
    }

    const projects = await this.prisma.project.findMany({
      select: { id: true, title: true, sourceLocale: true },
      orderBy: { createdAt: 'asc' },
    });

    let processed = 0;
    for (const project of projects) {
      const title = project.title?.trim();
      if (!title) {
        continue;
      }

      const sourceLocale = normalizeSourceLocale(project.sourceLocale);
      const targetLocales = SUPPORTED_LOCALES.filter(
        (locale) => locale !== sourceLocale,
      );

      await Promise.all(
        targetLocales.map((targetLocale) =>
          this.translations.translateAndCacheText({
            projectId: project.id,
            fieldKey: 'title',
            sourceText: project.title,
            sourceLocale,
            targetLocale,
          }),
        ),
      );
      processed += 1;
    }

    this.logger.log(`Warmed titles for ${processed} projects`);
    return { processed };
  }

  async localizePublicCard(
    project: {
      id: string;
      title: string;
      description: string | null;
      sourceLocale?: string | null;
    },
    targetLocale: SupportedLocale,
  ): Promise<{
    title: string;
    description: string | null;
    cacheMiss: boolean;
  }> {
    const sourceLocale = normalizeSourceLocale(project.sourceLocale);
    if (sourceLocale === targetLocale) {
      return {
        title: project.title,
        description: project.description,
        cacheMiss: false,
      };
    }

    let cacheMiss = false;

    const titleCached = await this.translations.getCachedText({
      projectId: project.id,
      fieldKey: 'title',
      sourceText: project.title,
      targetLocale,
    });
    if (titleCached == null && project.title.trim()) {
      cacheMiss = true;
    }

    let description = project.description;
    if (project.description?.trim()) {
      const descriptionCached = await this.translations.getCachedText({
        projectId: project.id,
        fieldKey: 'description',
        sourceText: project.description,
        targetLocale,
      });
      if (descriptionCached == null) {
        cacheMiss = true;
      } else {
        description = descriptionCached;
      }
    }

    return {
      title: titleCached ?? project.title,
      description,
      cacheMiss,
    };
  }

  private async warmField(
    field: TranslatableField,
    projectId: string,
    sourceLocale: SupportedLocale,
    targetLocale: SupportedLocale,
  ): Promise<void> {
    if (field.kind === 'text') {
      await this.translations.translateAndCacheText({
        projectId,
        fieldKey: field.fieldKey,
        sourceText: field.sourceText,
        sourceLocale,
        targetLocale,
      });
      return;
    }

    await this.translations.translateAndCacheJson({
      projectId,
      fieldKey: field.fieldKey,
      sourceValue: field.sourceValue,
      sourceLocale,
      targetLocale,
    });
  }

  async localizeProjectResponse(
    project: ProjectResponse,
    sourceLocale: SupportedLocale,
    targetLocale: SupportedLocale,
  ): Promise<{ response: ProjectResponse; cacheMiss: boolean }> {
    if (sourceLocale === targetLocale) {
      return { response: project, cacheMiss: false };
    }

    const projectId = project.id;
    let cacheMiss = false;

    const readText = async (
      fieldKey: string,
      sourceText: string | null | undefined,
    ): Promise<string | null> => {
      if (!sourceText) {
        return sourceText ?? null;
      }
      const cached = await this.translations.getCachedText({
        projectId,
        fieldKey,
        sourceText,
        targetLocale,
      });
      if (cached == null) {
        cacheMiss = true;
        return sourceText;
      }
      return cached;
    };

    const title = await readText('title', project.title);

    const description = project.description
      ? await readText('description', project.description)
      : project.description;

    const scopeSummary = await readText('scopeSummary', project.scopeSummary);
    const clarificationSummary = await readText(
      'clarificationSummary',
      project.clarificationSummary,
    );

    let brief = project.brief;
    if (brief) {
      const localizedBrief = await this.localizeBriefFromCache(
        projectId,
        brief,
        targetLocale,
        () => {
          cacheMiss = true;
        },
      );
      brief = localizedBrief;
    }

    let estimate = project.estimate;
    if (estimate) {
      const disclaimer =
        (await readText('estimate.disclaimer', estimate.disclaimer ?? '')) ??
        estimate.disclaimer;
      const lines = await Promise.all(
        estimate.lines.map(async (line, index) => {
          if (!line.description) {
            return line;
          }
          const description =
            (await readText(
              `estimate.line.${index}.description`,
              line.description,
            )) ?? line.description;
          return { ...line, description };
        }),
      );
      estimate = { ...estimate, disclaimer, lines };
    }

    return {
      response: {
        ...project,
        title: title ?? project.title,
        description,
        scopeSummary,
        clarificationSummary,
        brief,
        estimate,
      },
      cacheMiss,
    };
  }

  private async localizeBriefFromCache(
    projectId: string,
    brief: ProjectBriefV1,
    targetLocale: SupportedLocale,
    onMiss: () => void,
  ): Promise<ProjectBriefV1> {
    const next: ProjectBriefV1 = { ...brief };

    if (brief.summary) {
      const cached = await this.translations.getCachedText({
        projectId,
        fieldKey: 'brief.summary',
        sourceText: brief.summary,
        targetLocale,
      });
      next.summary = this.resolveText(cached, brief.summary, onMiss);
    }

    if (brief.packages?.length) {
      next.packages = await Promise.all(
        brief.packages.map(async (pkg, index) => {
          if (!pkg.description) {
            return pkg;
          }
          const cached = await this.translations.getCachedText({
            projectId,
            fieldKey: `brief.package.${index}.description`,
            sourceText: pkg.description,
            targetLocale,
          });
          return {
            ...pkg,
            description: this.resolveText(cached, pkg.description, onMiss),
          };
        }),
      );
    }

    if (brief.ai) {
      const ai = { ...brief.ai };

      if (ai.improvedDescription) {
        const cached = await this.translations.getCachedText({
          projectId,
          fieldKey: 'brief.ai.improvedDescription',
          sourceText: ai.improvedDescription,
          targetLocale,
        });
        ai.improvedDescription = this.resolveText(
          cached,
          ai.improvedDescription,
          onMiss,
        );
      }

      if (ai.documentInsights?.length) {
        ai.documentInsights = await Promise.all(
          ai.documentInsights.map(async (insight) => {
            const summaryCached = await this.translations.getCachedText({
              projectId,
              fieldKey: `insight.${insight.documentId}.summary`,
              sourceText: insight.summary,
              targetLocale,
            });
            const summary = this.resolveText(summaryCached, insight.summary, onMiss);

            let keyFacts = insight.keyFacts;
            if (keyFacts?.length) {
              keyFacts = await Promise.all(
                keyFacts.map(async (fact, factIndex) => {
                  const cached = await this.translations.getCachedText({
                    projectId,
                    fieldKey: `insight.${insight.documentId}.keyFact.${factIndex}`,
                    sourceText: fact,
                    targetLocale,
                  });
                  return this.resolveText(cached, fact, onMiss);
                }),
              );
            }

            let omittedNote = insight.omittedNote;
            if (omittedNote) {
              const cached = await this.translations.getCachedText({
                projectId,
                fieldKey: `insight.${insight.documentId}.omittedNote`,
                sourceText: omittedNote,
                targetLocale,
              });
              omittedNote = this.resolveText(cached, omittedNote, onMiss);
            }

            return { ...insight, summary, keyFacts, omittedNote };
          }),
        );
      }

      if (ai.intake?.currentQuestion) {
        const cached =
          await this.translations.getCachedJson<IntakeQuestion>({
            projectId,
            fieldKey: `intake.question.${ai.intake.currentQuestion.id}`,
            sourceValue: ai.intake.currentQuestion,
            targetLocale,
          });
        if (cached == null) {
          onMiss();
        }
        ai.intake = {
          ...ai.intake,
          currentQuestion: cached ?? ai.intake.currentQuestion,
        };
      }

      next.ai = ai;
    }

    return next;
  }

  private resolveText(
    cached: string | null,
    fallback: string,
    onMiss: () => void,
  ): string {
    if (cached == null) {
      onMiss();
      return fallback;
    }
    return cached;
  }
}

export function collectTranslatableFields(
  project: ProjectResponse,
): TranslatableField[] {
  const fields: TranslatableField[] = [];

  const addText = (fieldKey: string, sourceText: string | null | undefined) => {
    if (sourceText?.trim()) {
      fields.push({ kind: 'text', fieldKey, sourceText });
    }
  };

  addText('title', project.title);
  addText('description', project.description);
  addText('scopeSummary', project.scopeSummary);
  addText('clarificationSummary', project.clarificationSummary);

  const brief = project.brief;
  if (brief) {
    addText('brief.summary', brief.summary);
    brief.packages?.forEach((pkg, index) => {
      addText(`brief.package.${index}.description`, pkg.description);
    });

    if (brief.ai?.improvedDescription) {
      addText('brief.ai.improvedDescription', brief.ai.improvedDescription);
    }

    brief.ai?.documentInsights?.forEach((insight) => {
      addText(`insight.${insight.documentId}.summary`, insight.summary);
      insight.keyFacts?.forEach((fact, factIndex) => {
        addText(
          `insight.${insight.documentId}.keyFact.${factIndex}`,
          fact,
        );
      });
      addText(
        `insight.${insight.documentId}.omittedNote`,
        insight.omittedNote,
      );
    });

    if (brief.ai?.intake?.currentQuestion) {
      fields.push({
        kind: 'json',
        fieldKey: `intake.question.${brief.ai.intake.currentQuestion.id}`,
        sourceValue: brief.ai.intake.currentQuestion,
      });
    }
  }

  if (project.estimate) {
    addText('estimate.disclaimer', project.estimate.disclaimer);
    project.estimate.lines.forEach((line, index) => {
      addText(`estimate.line.${index}.description`, line.description);
    });
  }

  return fields;
}
