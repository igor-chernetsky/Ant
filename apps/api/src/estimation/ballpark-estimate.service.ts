import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from '../users/locale.types';
import { localeLanguageName } from '../localization/locale.utils';
import {
  BallparkEstimateResult,
  EstimateLine,
  EstimateTotals,
} from './estimates.types';
import {
  TH_REGIONAL_CATALOG,
  catalogSummaryForPrompt,
} from './regional-catalog';
import { ProjectBriefV1 } from '../projects/project-brief';
import {
  buildEstimateScopeRules,
  buildEstimateUserContext,
  collectEstimateNarrative,
  filterEstimateLines,
  filterImprovementQuestionsAgainstAnswers,
  finalizeEstimateLines,
  mergePreviousEstimateLines,
  resolveEstimateAreaSqm,
} from './estimate-scope.utils';
import {
  detectEstimateLineShareAnomalies,
  formatEstimateLineShareAnomaliesForPrompt,
  type EstimateLineShareAnomaly,
} from './estimate-line-anomalies';
import { isLandscapingOrCivilAmenityNarrative } from '../ai/intake-scope-heuristics';

const DISCLAIMER =
  'Ballpark estimate only — not a binding quote. Final pricing requires site visit and detailed scope review.';

const BUILDING_SHELL_IMPROVEMENT_QUESTION_PATTERN =
  /\b(storey|storeys|floors?|этаж|ชั้น|sanitary|wet\s*points?|сантех|foundation|фундамент|elevator|lift|лифт|basement|подвал)\b/i;

@Injectable()
export class BallparkEstimateService {
  private readonly logger = new Logger(BallparkEstimateService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    this.model =
      this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim();
  }

  async generate(input: {
    title: string;
    description: string | null;
    projectType: string;
    propertyType: string | null;
    district: string | null;
    regionCode: string;
    tagSlugs: string[];
    brief: ProjectBriefV1;
    locale?: SupportedLocale;
    previousLines?: EstimateLine[];
    clarificationQa?: Array<{ question: string; answer: string }>;
    clarificationSummary?: string | null;
    scopeSummary?: string | null;
    estimateRefinementQa?: Array<{ question: string; answer: string }>;
    /** When true, lines under 1% of total are not treated as anomalies (design). */
    allowTinyLineShare?: boolean;
  }): Promise<BallparkEstimateResult> {
    if (this.apiKey.length > 0) {
      const ai = await this.generateWithOpenAi(input);
      if (ai) return ai;
    }
    return this.generateFallback(input);
  }

  private async generateWithOpenAi(input: {
    title: string;
    description: string | null;
    projectType: string;
    propertyType: string | null;
    district: string | null;
    regionCode: string;
    tagSlugs: string[];
    brief: ProjectBriefV1;
    locale?: SupportedLocale;
    previousLines?: EstimateLine[];
    clarificationQa?: Array<{ question: string; answer: string }>;
    clarificationSummary?: string | null;
    scopeSummary?: string | null;
    estimateRefinementQa?: Array<{ question: string; answer: string }>;
    allowTinyLineShare?: boolean;
    anomalyFeedback?: EstimateLineShareAnomaly[];
    anomalyRetryDone?: boolean;
  }): Promise<BallparkEstimateResult | null> {
    const lang =
      input.locale && isSupportedLocale(input.locale)
        ? localeLanguageName(input.locale)
        : localeLanguageName(DEFAULT_LOCALE);
    const previousLines = input.previousLines ?? [];
    const landscapingOrCivilAmenityOnly = isLandscapingOrCivilAmenityNarrative(
      [input.title, input.description ?? ''].join(' '),
    );
    const scopeRules = buildEstimateScopeRules(
      input.projectType,
      input.propertyType,
      previousLines.length > 0,
      { landscapingOrCivilAmenityOnly },
    );
    const anomalyDirectives = formatEstimateLineShareAnomaliesForPrompt(
      input.anomalyFeedback ?? [],
    );
    const system = `You produce ballpark construction cost estimates for Thailand (THB).
Return JSON: { lines, totals, confidence, disclaimer, improvementQuestions }.
Each line: { trade, description, quantity, unit, unitPriceMin, unitPriceMax, lineMin, lineMax }.
totals: { minAmount, maxAmount, midAmount, currency: "THB" }.
confidence: number 0–1 reflecting how complete and certain the priced scope is.
improvementQuestions: 0–5 short questions (in ${lang}) that would most improve confidence if answered. Empty array when confidence is already high or nothing material is missing.
CRITICAL: Do not repeat or rephrase questions already answered in estimateRefinementQa. If a topic+space was already covered (e.g. office finishing, warehouse lighting, plumbing), do not ask again with wording like "exact requirements" or "additional requirements". Prefer a genuinely new gap only; otherwise return [].
Do NOT invent priced scope for unanswered gaps — put that uncertainty into improvementQuestions and keep confidence lower.
When regenerating with previousEstimate and/or estimateRefinementQa, retain still-confirmed trades/lines unless answers change them; never drop confirmed scope.
Use regional reference prices as guidance; prefer mid-to-high of catalog bands for MEP networks, lighting fixtures, utility connections, and premium treatment systems.
Include 5-16 lines covering the FULL confirmed scope (base construction + detailed MEP + finishing + newly added items). Split MEP into multiple lines when intake/premium signals justify it.
When the client requests fire suppression / sprinklers or other named specialty systems, include a dedicated line (trade fire-suppression or other) — never description-only.
Supply/exhaust or warehouse/production ventilation: price HVAC per sqm (~1,200–3,200 THB/sqm), not as one residential AC unit.
Prefer one consolidated electrical line for base wiring/board/lighting — do not stack duplicate electrical rows.
For sqm trades (structural, roofing, flooring, warehouse HVAC): quantity MUST be building GFA (resolvedAreaSqm), never 1 and never building height in metres. Height/storeys may raise unit rates, not replace area as quantity.
lineMin/lineMax must equal quantity * unitPriceMin/Max (rounded).
Obey pricingDirectives and premiumScopeSignals in the user payload — they must change amounts, not only wording.
When clarificationQa or clarificationSummary is present, treat that as new pricing-relevant scope and revise MEP/network lines upward when they add utilities, lighting, treatment, or connection works.
Distribution sanity: with 3+ lines no single line should exceed ~70% of the total mid amount; with 5+ lines ~50%; with 10+ lines ~30%. Avoid near-zero lines under ~1% of the total unless they are truly tiny optional extras.
When distributionAnomalies / REBALANCE directives are present, RECALCULATE amounts so the distribution is realistic — do not only reword descriptions.
Write description, disclaimer, and improvementQuestions fields in ${lang}.
Scope rules:
${scopeRules}`;

    const userContext = buildEstimateUserContext({
      ...input,
      previousLines,
    });
    if (anomalyDirectives.length > 0) {
      userContext.pricingDirectives = [
        ...(userContext.pricingDirectives ?? []),
        'REBALANCE: previous estimate had anomalous line shares — recalculate unit rates and quantities.',
        ...anomalyDirectives,
      ];
      (userContext as Record<string, unknown>).distributionAnomalies =
        input.anomalyFeedback?.map((anomaly) => ({
          trade: anomaly.trade,
          kind: anomaly.kind,
          sharePercent: Math.round(anomaly.share * 1000) / 10,
          thresholdPercent: Math.round(anomaly.threshold * 1000) / 10,
          lineCount: anomaly.lineCount,
        }));
    }

    const user = JSON.stringify({
      ...userContext,
      regionalCatalog: catalogSummaryForPrompt(),
    });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: input.anomalyRetryDone ? 0.2 : 0.15,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Estimate HTTP ${response.status}: ${text.slice(0, 200)}`);
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return null;

      const result = this.normalizeResult(
        JSON.parse(content) as Record<string, unknown>,
        input,
      );

      const anomalies = detectEstimateLineShareAnomalies(result.lines, {
        allowTinyShare: input.allowTinyLineShare,
      });

      if (anomalies.length > 0 && !input.anomalyRetryDone) {
        this.logger.warn(
          `Estimate line-share anomalies (${anomalies.length}); recalculating once: ${anomalies
            .map(
              (a) =>
                `${a.kind}:${a.trade}@${Math.round(a.share * 100)}%`,
            )
            .join(', ')}`,
        );
        const retried = await this.generateWithOpenAi({
          ...input,
          anomalyFeedback: anomalies,
          anomalyRetryDone: true,
          previousLines: result.lines,
        });
        if (retried) {
          const stillBad = detectEstimateLineShareAnomalies(retried.lines, {
            allowTinyShare: input.allowTinyLineShare,
          });
          if (stillBad.length > 0) {
            this.logger.warn(
              `Estimate still anomalous after recalculation (${stillBad.length} flags); keeping retry result with lower confidence`,
            );
            return {
              ...retried,
              confidence: Math.min(retried.confidence, 0.45),
            };
          }
          return retried;
        }
        return {
          ...result,
          confidence: Math.min(result.confidence, 0.45),
        };
      }

      if (anomalies.length > 0) {
        return {
          ...result,
          confidence: Math.min(result.confidence, 0.45),
        };
      }

      return result;
    } catch (err) {
      this.logger.warn(
        `Estimate failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private generateFallback(input: {
    title: string;
    description: string | null;
    projectType: string;
    propertyType: string | null;
    tagSlugs: string[];
    brief: ProjectBriefV1;
    previousLines?: EstimateLine[];
    clarificationQa?: Array<{ question: string; answer: string }>;
    clarificationSummary?: string | null;
    scopeSummary?: string | null;
    estimateRefinementQa?: Array<{ question: string; answer: string }>;
    allowTinyLineShare?: boolean;
  }): BallparkEstimateResult {
    const narrative = collectEstimateNarrative({
      title: input.title,
      description: input.description,
      tagSlugs: input.tagSlugs,
      brief: input.brief,
      clarificationQa: input.clarificationQa,
      clarificationSummary: input.clarificationSummary,
      scopeSummary: input.scopeSummary,
    });
    const areaSqm = resolveEstimateAreaSqm(input.brief, narrative);

    const trades = new Set<string>();
    for (const slug of input.tagSlugs) {
      trades.add(slug);
    }
    for (const pkg of input.brief.packages ?? []) {
      trades.add(pkg.trade);
    }
    for (const line of input.previousLines ?? []) {
      trades.add(line.trade);
    }
    if (trades.size === 0) {
      trades.add('finishing');
    }

    const lines: EstimateLine[] = [];
    for (const trade of trades) {
      const catalog = TH_REGIONAL_CATALOG.find((c) => c.trade === trade);
      if (!catalog) continue;

      const previous = input.previousLines?.find((line) => line.trade === trade);
      const pkg = input.brief.packages?.find((p) => p.trade === trade);
      const quantity =
        pkg?.quantity ??
        previous?.quantity ??
        (catalog.unit === 'sqm' ? areaSqm : catalog.unit === 'lump' ? 1 : 1);
      const unit = pkg?.unit ?? previous?.unit ?? catalog.unit;
      const unitPriceMin = Math.max(
        catalog.priceMinThb,
        previous?.unitPriceMin ?? 0,
      );
      const unitPriceMax = Math.max(
        catalog.priceMaxThb,
        previous?.unitPriceMax ?? 0,
        unitPriceMin,
      );
      const lineMin = Math.round(unitPriceMin * quantity);
      const lineMax = Math.round(unitPriceMax * quantity);

      lines.push({
        trade,
        description: pkg?.description ?? previous?.description ?? catalog.label,
        quantity,
        unit,
        unitPriceMin,
        unitPriceMax,
        lineMin,
        lineMax,
      });
    }

    if (lines.length === 0) {
      const catalog = TH_REGIONAL_CATALOG.find((c) => c.trade === 'finishing')!;
      lines.push({
        trade: 'finishing',
        description: `General scope for "${input.title}"`,
        quantity: areaSqm,
        unit: 'sqm',
        unitPriceMin: catalog.priceMinThb,
        unitPriceMax: catalog.priceMaxThb,
        lineMin: Math.round(catalog.priceMinThb * areaSqm),
        lineMax: Math.round(catalog.priceMaxThb * areaSqm),
      });
    }

    const filteredLines = filterEstimateLines({
      lines,
      projectType: input.projectType,
      propertyType: input.propertyType,
      description: input.description,
      brief: input.brief,
    });
    const mergedLines = mergePreviousEstimateLines({
      nextLines: filteredLines.length > 0 ? filteredLines : lines,
      previousLines: input.previousLines ?? [],
      description: input.description,
      brief: input.brief,
      tagSlugs: input.tagSlugs,
    });
    const adjustedLines = finalizeEstimateLines({
      lines: mergedLines,
      narrative,
      tagSlugs: input.tagSlugs,
      brief: input.brief,
    }).map(normalizeLineAmounts);

    const totals = computeTotals(adjustedLines);
    const textLen = (input.description ?? '').length;
    const anomalies = detectEstimateLineShareAnomalies(adjustedLines, {
      allowTinyShare: input.allowTinyLineShare,
    });
    if (anomalies.length > 0) {
      this.logger.warn(
        `Fallback estimate has ${anomalies.length} line-share anomalies`,
      );
    }

    const confidence = Math.min(
      0.65,
      0.25 +
        (input.brief.packages?.length ?? 0) * 0.05 +
        (textLen > 50 ? 0.1 : 0),
    );

    return {
      lines: adjustedLines,
      totals,
      confidence,
      disclaimer: DISCLAIMER,
      provider: 'fallback',
      improvementQuestions: [],
    };
  }

  private normalizeResult(
    raw: Record<string, unknown>,
    input: {
      title: string;
      projectType: string;
      propertyType: string | null;
      description: string | null;
      brief: ProjectBriefV1;
      tagSlugs: string[];
      previousLines?: EstimateLine[];
      clarificationQa?: Array<{ question: string; answer: string }>;
      clarificationSummary?: string | null;
      scopeSummary?: string | null;
      estimateRefinementQa?: Array<{ question: string; answer: string }>;
    },
  ): BallparkEstimateResult {
    const rawLines = Array.isArray(raw.lines)
      ? raw.lines
          .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
          .map((l) => ({
            trade: String(l.trade ?? 'other').slice(0, 64),
            description: String(l.description ?? '').slice(0, 500),
            quantity: typeof l.quantity === 'number' ? l.quantity : 1,
            unit: String(l.unit ?? 'lump').slice(0, 32),
            unitPriceMin: Math.round(Number(l.unitPriceMin) || 0),
            unitPriceMax: Math.round(Number(l.unitPriceMax) || 0),
            lineMin: Math.round(Number(l.lineMin) || 0),
            lineMax: Math.round(Number(l.lineMax) || 0),
          }))
          .filter((l) => l.description.length > 0)
      : [];

    const filtered = filterEstimateLines({
      lines: rawLines,
      projectType: input.projectType,
      propertyType: input.propertyType,
      description: input.description,
      brief: input.brief,
    });

    const merged = mergePreviousEstimateLines({
      nextLines: filtered,
      previousLines: input.previousLines ?? [],
      description: input.description,
      brief: input.brief,
      tagSlugs: input.tagSlugs,
    });

    const narrative = collectEstimateNarrative({
      title: input.title,
      description: input.description,
      tagSlugs: input.tagSlugs,
      brief: input.brief,
      clarificationQa: input.clarificationQa,
      clarificationSummary: input.clarificationSummary,
      scopeSummary: input.scopeSummary,
    });
    const lines = finalizeEstimateLines({
      lines: merged,
      narrative,
      tagSlugs: input.tagSlugs,
      brief: input.brief,
    }).map(normalizeLineAmounts);

    const totals = computeTotals(lines);
    const answeredQuestions = (input.estimateRefinementQa ?? []).map(
      (row) => row.question,
    );
    const landscapingOrCivilAmenityOnly = isLandscapingOrCivilAmenityNarrative(
      [input.title, input.description ?? ''].join(' '),
    );
    const rawImprovementQuestions = Array.isArray(raw.improvementQuestions)
      ? raw.improvementQuestions
          .filter((q): q is string => typeof q === 'string')
          .map((q) => q.trim().slice(0, 280))
          .filter((q) => q.length > 0)
          .filter(
            (q) =>
              !landscapingOrCivilAmenityOnly ||
              !BUILDING_SHELL_IMPROVEMENT_QUESTION_PATTERN.test(q),
          )
      : [];
    const improvementQuestions = filterImprovementQuestionsAgainstAnswers(
      rawImprovementQuestions,
      answeredQuestions,
    ).slice(0, 5);

    const rawConfidence =
      typeof raw.confidence === 'number'
        ? Math.min(1, Math.max(0, raw.confidence))
        : 0.5;

    return {
      lines,
      totals,
      confidence: rawConfidence,
      disclaimer: String(raw.disclaimer ?? DISCLAIMER).slice(0, 2000),
      provider: 'openai',
      improvementQuestions,
    };
  }
}

function normalizeLineAmounts(line: EstimateLine): EstimateLine {
  const quantity = Number.isFinite(line.quantity) && line.quantity > 0
    ? line.quantity
    : 1;
  const unitPriceMin = Math.max(0, line.unitPriceMin);
  const unitPriceMax = Math.max(unitPriceMin, line.unitPriceMax);
  const lineMin =
    line.lineMin > 0 ? line.lineMin : Math.round(unitPriceMin * quantity);
  const lineMax =
    line.lineMax > 0 ? line.lineMax : Math.round(unitPriceMax * quantity);

  return {
    ...line,
    quantity,
    unitPriceMin,
    unitPriceMax,
    lineMin: Math.min(lineMin, lineMax),
    lineMax: Math.max(lineMin, lineMax),
  };
}

export function computeTotals(lines: EstimateLine[]): EstimateTotals {
  const minAmount = lines.reduce((sum, l) => sum + l.lineMin, 0);
  const maxAmount = lines.reduce((sum, l) => sum + l.lineMax, 0);
  return {
    minAmount,
    maxAmount,
    midAmount: Math.round((minAmount + maxAmount) / 2),
    currency: 'THB',
  };
}
