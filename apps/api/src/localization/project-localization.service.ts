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
import type {
  BidContractTerms,
  BidTermsV1,
  DefaultCostBreakdownItem,
} from '../tendering/tendering.types';

/** Free-text tender package fields filled by the client that contractors need localized. */
export const CONTRACT_TERMS_TRANSLATABLE_KEYS = [
  'subjectOfContract',
  'siteAddress',
  'propertyOwnership',
  'employerName',
  'employerAddress',
  'contractorAddress',
  'contractorRepresentative',
  'retentionReleaseNotes',
  'warrantyPeriodNotes',
  'delayDamagesNotes',
  'specialConditions',
] as const satisfies ReadonlyArray<keyof BidContractTerms>;

/**
 * Contractor-only free-text contract fields shown to the client.
 * Safe to localize in API responses because the client save payload
 * does not include these keys (see pickClientContractTerms).
 */
const BID_VIEW_CONTRACTOR_TERM_KEYS = [
  'subjectOfContract',
  'contractorAddress',
  'contractorRepresentative',
] as const satisfies ReadonlyArray<keyof BidContractTerms>;

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

  scheduleWarmClarificationQa(
    projectId: string,
    rows: Array<{ id: string; questionText: string; answer?: string | null }>,
  ): void {
    if (!this.openAi.isConfigured() || rows.length === 0) {
      return;
    }

    void this.warmClarificationQa(projectId, rows).catch((err) => {
      this.logger.warn(
        `Clarification Q&A warm failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async warmClarificationQa(
    projectId: string,
    rows: Array<{ id: string; questionText: string; answer?: string | null }>,
  ): Promise<void> {
    for (const locale of SUPPORTED_LOCALES) {
      await Promise.all(
        rows.map(async (row) => {
          if (row.questionText.trim()) {
            await this.translations.translateAndCacheTextAuto({
              projectId,
              fieldKey: `clarification.question.${row.id}`,
              sourceText: row.questionText,
              targetLocale: locale,
            });
          }
          if (row.answer?.trim()) {
            await this.translations.translateAndCacheTextAuto({
              projectId,
              fieldKey: `clarification.answer.${row.id}`,
              sourceText: row.answer,
              targetLocale: locale,
            });
          }
        }),
      );
    }
  }

  async localizeClarificationQa<
    T extends { id: string; questionText: string; answer?: string | null },
  >(
    projectId: string,
    rows: T[],
    targetLocale: SupportedLocale,
  ): Promise<T[]> {
    if (rows.length === 0) {
      return rows;
    }

    return Promise.all(
      rows.map(async (row) => {
        const questionText = row.questionText.trim()
          ? await this.translations.translateAndCacheTextAuto({
              projectId,
              fieldKey: `clarification.question.${row.id}`,
              sourceText: row.questionText,
              targetLocale,
            })
          : row.questionText;

        const answer =
          row.answer?.trim()
            ? await this.translations.translateAndCacheTextAuto({
                projectId,
                fieldKey: `clarification.answer.${row.id}`,
                sourceText: row.answer,
                targetLocale,
              })
            : row.answer;

        return { ...row, questionText, answer };
      }),
    );
  }

  async localizeTextAuto(
    projectId: string,
    fieldKey: string,
    sourceText: string,
    targetLocale: SupportedLocale,
  ): Promise<string> {
    return this.translations.translateAndCacheTextAuto({
      projectId,
      fieldKey,
      sourceText,
      targetLocale,
    });
  }

  /**
   * Force all commercial-proposal free text into one target language.
   * Uses auto-detect translation so UI-language option values (ru/th/en)
   * do not leak into a document generated for another locale.
   */
  /**
   * Localize contractor-authored bid/proposal text for an in-app viewer.
   * Uses the same cache keys as PDF generation where possible so viewing
   * warms translations for later downloads.
   */
  async localizeBidTermsForViewer(
    projectId: string,
    entityKey: string,
    terms: BidTermsV1 | null | undefined,
    targetLocale: SupportedLocale,
    options?: { includeContractorContractTerms?: boolean },
  ): Promise<BidTermsV1 | null> {
    if (!terms) {
      return null;
    }

    const translate = async (
      fieldKey: string,
      sourceText: string | null | undefined,
    ): Promise<string | undefined> => {
      if (!sourceText?.trim()) {
        return sourceText ?? undefined;
      }
      return this.translations.translateAndCacheTextAuto({
        projectId,
        fieldKey,
        sourceText,
        targetLocale,
      });
    };

    const scopeSummary = await translate(
      `${entityKey}.scopeSummary`,
      terms.scopeSummary,
    );
    const notes = await translate(`${entityKey}.notes`, terms.notes);
    const approach = await translate(`${entityKey}.approach`, terms.approach);

    const lineItems = terms.lineItems
      ? await Promise.all(
          terms.lineItems.map(async (item, index) => ({
            ...item,
            trade:
              (await translate(`${entityKey}.line.${index}.trade`, item.trade)) ??
              item.trade,
            description: item.description?.trim()
              ? ((await translate(
                  `${entityKey}.line.${index}.description`,
                  item.description,
                )) ?? item.description)
              : item.description,
          })),
        )
      : undefined;

    let contractTerms = terms.contractTerms;
    if (
      options?.includeContractorContractTerms !== false &&
      terms.contractTerms
    ) {
      const next: BidContractTerms = { ...terms.contractTerms };
      for (const key of BID_VIEW_CONTRACTOR_TERM_KEYS) {
        const sourceText = terms.contractTerms[key];
        if (typeof sourceText !== 'string' || !sourceText.trim()) {
          continue;
        }
        next[key] = (await translate(
          `${entityKey}.contractTerms.${key}`,
          sourceText,
        )) as never;
      }
      contractTerms = next;
    }

    return {
      ...terms,
      scopeSummary,
      notes,
      approach,
      lineItems,
      contractTerms,
    };
  }

  scheduleWarmBidTerms(
    projectId: string,
    entityKey: string,
    terms: BidTermsV1 | null | undefined,
  ): void {
    if (!this.openAi.isConfigured() || !terms) {
      return;
    }

    void this.warmBidTerms(projectId, entityKey, terms).catch((err) => {
      this.logger.warn(
        `Bid terms warm failed for ${projectId}/${entityKey}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  async warmBidTerms(
    projectId: string,
    entityKey: string,
    terms: BidTermsV1,
  ): Promise<void> {
    for (const locale of SUPPORTED_LOCALES) {
      await this.localizeBidTermsForViewer(
        projectId,
        entityKey,
        terms,
        locale,
      );
    }
  }

  async localizeCommercialProposalContent(
    projectId: string,
    bidId: string,
    input: {
      title?: string | null;
      description?: string | null;
      district?: string | null;
      scopeSummary?: string | null;
      clarificationSummary?: string | null;
      approach?: string | null;
      notes?: string | null;
      contractTerms?: BidContractTerms | null;
      lineItems?: Array<{ trade: string; description?: string; amount: number }>;
    },
    targetLocale: SupportedLocale,
  ): Promise<{
    title: string;
    description: string | null;
    district: string | null;
    scopeSummary: string | null;
    clarificationSummary: string | null;
    approach: string | null;
    notes: string | null;
    contractTerms: BidContractTerms;
    lineItems: Array<{ trade: string; description?: string; amount: number }>;
  }> {
    const translate = async (
      fieldKey: string,
      sourceText: string | null | undefined,
    ): Promise<string | null> => {
      if (!sourceText?.trim()) {
        return sourceText ?? null;
      }
      return this.translations.translateAndCacheTextAuto({
        projectId,
        fieldKey,
        sourceText,
        targetLocale,
      });
    };

    const title =
      (await translate('title', input.title)) ?? input.title ?? '';
    const description = await translate('description', input.description);
    const district = await translate('district', input.district);
    const scopeSummary = await translate(
      `bid.${bidId}.scopeSummary`,
      input.scopeSummary,
    );
    const clarificationSummary = await translate(
      'clarificationSummary',
      input.clarificationSummary,
    );
    const approach = await translate(`bid.${bidId}.approach`, input.approach);
    const notes = await translate(`bid.${bidId}.notes`, input.notes);

    const contractTerms: BidContractTerms = {
      ...(input.contractTerms ?? {}),
    };
    for (const key of CONTRACT_TERMS_TRANSLATABLE_KEYS) {
      const sourceText = input.contractTerms?.[key];
      if (typeof sourceText !== 'string' || !sourceText.trim()) {
        continue;
      }
      contractTerms[key] = (await translate(
        `contractTerms.${key}`,
        sourceText,
      )) as never;
    }

    const lineItems = await Promise.all(
      (input.lineItems ?? []).map(async (item, index) => ({
        ...item,
        trade:
          (await translate(`bid.${bidId}.line.${index}.trade`, item.trade)) ??
          item.trade,
        description: item.description?.trim()
          ? ((await translate(
              `bid.${bidId}.line.${index}.description`,
              item.description,
            )) ?? item.description)
          : item.description,
      })),
    );

    return {
      title,
      description,
      district,
      scopeSummary,
      clarificationSummary,
      approach,
      notes,
      contractTerms,
      lineItems,
    };
  }

  async getLocalizedProjectTitle(
    projectId: string,
    sourceTitle: string,
    targetLocale: SupportedLocale,
  ): Promise<string> {
    const cached = await this.translations.getCachedText({
      projectId,
      fieldKey: 'title',
      sourceText: sourceTitle,
      targetLocale,
    });
    if (cached != null) {
      return cached;
    }
    return this.translations.translateAndCacheTextAuto({
      projectId,
      fieldKey: 'title',
      sourceText: sourceTitle,
      targetLocale,
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

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { defaultCostBreakdown: true },
    });
    const contractTerms = (project.tenderContractTermsJson ??
      null) as BidContractTerms | null;
    const breakdown = Array.isArray(tender?.defaultCostBreakdown)
      ? (tender!.defaultCostBreakdown as unknown as DefaultCostBreakdownItem[])
      : [];

    for (const targetLocale of targetLocales) {
      await this.warmContractTerms(
        projectId,
        contractTerms,
        sourceLocale,
        targetLocale,
      );
      await this.warmCostBreakdown(
        projectId,
        breakdown,
        sourceLocale,
        targetLocale,
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

  async localizeContractTerms(
    projectId: string,
    terms: BidContractTerms | null | undefined,
    sourceLocale: SupportedLocale,
    targetLocale: SupportedLocale,
  ): Promise<{ terms: BidContractTerms; cacheMiss: boolean }> {
    if (!terms || sourceLocale === targetLocale) {
      return { terms: terms ?? {}, cacheMiss: false };
    }

    let cacheMiss = false;
    const next: BidContractTerms = { ...terms };

    for (const key of CONTRACT_TERMS_TRANSLATABLE_KEYS) {
      const sourceText = terms[key];
      if (typeof sourceText !== 'string' || !sourceText.trim()) {
        continue;
      }
      const cached = await this.translations.getCachedText({
        projectId,
        fieldKey: `contractTerms.${key}`,
        sourceText,
        targetLocale,
      });
      if (cached == null) {
        cacheMiss = true;
        continue;
      }
      next[key] = cached as never;
    }

    return { terms: next, cacheMiss };
  }

  async localizeCostBreakdown(
    projectId: string,
    items: DefaultCostBreakdownItem[],
    sourceLocale: SupportedLocale,
    targetLocale: SupportedLocale,
  ): Promise<{ items: DefaultCostBreakdownItem[]; cacheMiss: boolean }> {
    if (sourceLocale === targetLocale || items.length === 0) {
      return { items, cacheMiss: false };
    }

    let cacheMiss = false;
    const next = await Promise.all(
      items.map(async (item, index) => {
        if (!item.description?.trim()) {
          return item;
        }
        const cached = await this.translations.getCachedText({
          projectId,
          fieldKey: `defaultCost.${index}.description`,
          sourceText: item.description,
          targetLocale,
        });
        if (cached == null) {
          cacheMiss = true;
          return item;
        }
        return { ...item, description: cached };
      }),
    );

    return { items: next, cacheMiss };
  }

  async localizeTenderPackageTexts(
    projectId: string,
    input: {
      title?: string | null;
      description?: string | null;
      scopeSummary?: string | null;
      clarificationSummary?: string | null;
      contractTerms?: BidContractTerms | null;
      costBreakdown?: DefaultCostBreakdownItem[];
      sourceLocale?: string | null;
    },
    targetLocale: SupportedLocale,
  ): Promise<{
    title: string | null;
    description: string | null;
    scopeSummary: string | null;
    clarificationSummary: string | null;
    contractTerms: BidContractTerms;
    costBreakdown: DefaultCostBreakdownItem[];
    cacheMiss: boolean;
  }> {
    const sourceLocale = normalizeSourceLocale(input.sourceLocale);
    if (sourceLocale === targetLocale) {
      return {
        title: input.title ?? null,
        description: input.description ?? null,
        scopeSummary: input.scopeSummary ?? null,
        clarificationSummary: input.clarificationSummary ?? null,
        contractTerms: input.contractTerms ?? {},
        costBreakdown: input.costBreakdown ?? [],
        cacheMiss: false,
      };
    }

    let cacheMiss = false;

    const readText = async (
      fieldKey: string,
      sourceText: string | null | undefined,
    ): Promise<string | null> => {
      if (!sourceText?.trim()) {
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

    const title = await readText('title', input.title);
    const description = await readText('description', input.description);
    const scopeSummary = await readText('scopeSummary', input.scopeSummary);
    const clarificationSummary = await readText(
      'clarificationSummary',
      input.clarificationSummary,
    );
    const { terms, cacheMiss: termsMiss } = await this.localizeContractTerms(
      projectId,
      input.contractTerms,
      sourceLocale,
      targetLocale,
    );
    const { items, cacheMiss: breakdownMiss } =
      await this.localizeCostBreakdown(
        projectId,
        input.costBreakdown ?? [],
        sourceLocale,
        targetLocale,
      );

    return {
      title,
      description,
      scopeSummary,
      clarificationSummary,
      contractTerms: terms,
      costBreakdown: items,
      cacheMiss: cacheMiss || termsMiss || breakdownMiss,
    };
  }

  private async warmContractTerms(
    projectId: string,
    terms: BidContractTerms | null | undefined,
    sourceLocale: SupportedLocale,
    targetLocale: SupportedLocale,
  ): Promise<void> {
    if (!terms) {
      return;
    }
    await Promise.all(
      CONTRACT_TERMS_TRANSLATABLE_KEYS.map((key) => {
        const sourceText = terms[key];
        if (typeof sourceText !== 'string' || !sourceText.trim()) {
          return Promise.resolve();
        }
        return this.translations.translateAndCacheText({
          projectId,
          fieldKey: `contractTerms.${key}`,
          sourceText,
          sourceLocale,
          targetLocale,
        });
      }),
    );
  }

  private async warmCostBreakdown(
    projectId: string,
    items: DefaultCostBreakdownItem[],
    sourceLocale: SupportedLocale,
    targetLocale: SupportedLocale,
  ): Promise<void> {
    await Promise.all(
      items.map((item, index) => {
        if (!item.description?.trim()) {
          return Promise.resolve();
        }
        return this.translations.translateAndCacheText({
          projectId,
          fieldKey: `defaultCost.${index}.description`,
          sourceText: item.description,
          sourceLocale,
          targetLocale,
        });
      }),
    );
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
