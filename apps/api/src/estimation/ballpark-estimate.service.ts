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
  filterEstimateLines,
} from './estimate-scope.utils';

const DISCLAIMER =
  'Ballpark estimate only — not a binding quote. Final pricing requires site visit and detailed scope review.';

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
  }): Promise<BallparkEstimateResult | null> {
    const lang =
      input.locale && isSupportedLocale(input.locale)
        ? localeLanguageName(input.locale)
        : localeLanguageName(DEFAULT_LOCALE);
    const scopeRules = buildEstimateScopeRules(
      input.projectType,
      input.propertyType,
    );
    const system = `You produce ballpark construction cost estimates for Thailand (THB).
Return JSON: { lines, totals, confidence, disclaimer }.
Each line: { trade, description, quantity, unit, unitPriceMin, unitPriceMax, lineMin, lineMax }.
totals: { minAmount, maxAmount, midAmount, currency: "THB" }.
Use regional reference prices as guidance only. Be conservative with ranges.
Include 3-12 lines covering confirmed scope only. confidence 0-1.
Write description and disclaimer fields in ${lang}.
Scope rules:
${scopeRules}`;

    const user = JSON.stringify({
      ...buildEstimateUserContext(input),
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
          temperature: 0.15,
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

      return this.normalizeResult(
        JSON.parse(content) as Record<string, unknown>,
        input,
      );
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
  }): BallparkEstimateResult {
    const areaSqm =
      input.brief.property?.areaSqm ??
      (input.brief.packages?.find((p) => p.areaSqm)?.areaSqm ?? 50);

    const trades = new Set<string>();
    for (const slug of input.tagSlugs) {
      trades.add(slug);
    }
    for (const pkg of input.brief.packages ?? []) {
      trades.add(pkg.trade);
    }
    if (trades.size === 0) {
      trades.add('finishing');
    }

    const lines: EstimateLine[] = [];
    for (const trade of trades) {
      const catalog = TH_REGIONAL_CATALOG.find((c) => c.trade === trade);
      if (!catalog) continue;

      const pkg = input.brief.packages?.find((p) => p.trade === trade);
      const quantity =
        pkg?.quantity ??
        (catalog.unit === 'sqm' ? areaSqm : catalog.unit === 'lump' ? 1 : 1);
      const unit = pkg?.unit ?? catalog.unit;
      const lineMin = Math.round(catalog.priceMinThb * quantity);
      const lineMax = Math.round(catalog.priceMaxThb * quantity);

      lines.push({
        trade,
        description: pkg?.description ?? catalog.label,
        quantity,
        unit,
        unitPriceMin: catalog.priceMinThb,
        unitPriceMax: catalog.priceMaxThb,
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
    const safeLines =
      filteredLines.length > 0
        ? filteredLines
        : lines.filter((line) => line.trade !== 'elevator');

    const totals = computeTotals(safeLines);
    const textLen = (input.description ?? '').length;
    const confidence = Math.min(
      0.65,
      0.25 +
        (input.brief.packages?.length ?? 0) * 0.05 +
        (textLen > 50 ? 0.1 : 0),
    );

    return {
      lines: safeLines,
      totals,
      confidence,
      disclaimer: DISCLAIMER,
      provider: 'fallback',
    };
  }

  private normalizeResult(
    raw: Record<string, unknown>,
    input: {
      projectType: string;
      propertyType: string | null;
      description: string | null;
      brief: ProjectBriefV1;
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

    const lines = filterEstimateLines({
      lines: rawLines,
      projectType: input.projectType,
      propertyType: input.propertyType,
      description: input.description,
      brief: input.brief,
    });

    const rawTotals = raw.totals as Record<string, unknown> | undefined;
    const totals: EstimateTotals =
      lines.length > 0
        ? computeTotals(lines)
        : rawTotals && typeof rawTotals === 'object'
          ? {
              minAmount: Math.round(Number(rawTotals.minAmount) || 0),
              maxAmount: Math.round(Number(rawTotals.maxAmount) || 0),
              midAmount: Math.round(
                Number(rawTotals.midAmount) ||
                  (Number(rawTotals.minAmount) + Number(rawTotals.maxAmount)) / 2,
              ),
              currency: String(rawTotals.currency ?? 'THB'),
            }
          : computeTotals(lines);

    return {
      lines,
      totals,
      confidence:
        typeof raw.confidence === 'number'
          ? Math.min(1, Math.max(0, raw.confidence))
          : 0.5,
      disclaimer: String(raw.disclaimer ?? DISCLAIMER).slice(0, 2000),
      provider: 'openai',
    };
  }
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
