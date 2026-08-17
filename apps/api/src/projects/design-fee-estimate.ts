import type { EstimateLine, EstimateTotals } from '../estimation/estimates.types';
import { designFeePercentFor } from './design-permits.utils';
import type { PropertyType } from '@prisma/client';

const PUBLIC_DESIGN_DISCLAIMER =
  'Ballpark estimate only — not a binding quote. Final pricing requires a detailed design brief and scope review.';

const DESIGN_LINE_PREFIX = 'Design:';

/** Do not expose the internal % of construction shortcut in client-facing copy. */
export function sanitizeDesignFeeDisclaimer(disclaimer: string): string {
  if (
    /design fee ballpark/i.test(disclaimer) ||
    /\d+\s*%\s*of estimated construction/i.test(disclaimer) ||
    /construction amounts are not shown/i.test(disclaimer)
  ) {
    return PUBLIC_DESIGN_DISCLAIMER;
  }
  return disclaimer;
}

export function roundMoney(value: number): number {
  return Math.round(value);
}

/** Stored design-fee rows are prefixed so we do not scale them twice on read. */
export function isDesignScaledEstimate(lines: EstimateLine[]): boolean {
  return lines.some((line) => line.description.startsWith(DESIGN_LINE_PREFIX));
}

export function scaleEstimateByPercent(
  lines: EstimateLine[],
  totals: EstimateTotals,
  percent: number,
): { lines: EstimateLine[]; totals: EstimateTotals } {
  const factor = percent / 100;
  return {
    lines: lines.map((line) => ({
      ...line,
      description: line.description.startsWith(DESIGN_LINE_PREFIX)
        ? line.description
        : `${DESIGN_LINE_PREFIX} ${line.description}`,
      unitPriceMin: roundMoney(line.unitPriceMin * factor),
      unitPriceMax: roundMoney(line.unitPriceMax * factor),
      lineMin: roundMoney(line.lineMin * factor),
      lineMax: roundMoney(line.lineMax * factor),
    })),
    totals: {
      minAmount: roundMoney(totals.minAmount * factor),
      maxAmount: roundMoney(totals.maxAmount * factor),
      midAmount: roundMoney(totals.midAmount * factor),
      currency: totals.currency,
    },
  };
}

export function buildDesignFeeEstimate(input: {
  lines: EstimateLine[];
  totals: EstimateTotals;
  propertyType?: PropertyType | null;
  tagSlugs?: string[];
  disclaimer?: string;
}): {
  percent: number;
  lines: EstimateLine[];
  totals: EstimateTotals;
  baseTotals: EstimateTotals;
  disclaimer: string;
} {
  const percent = designFeePercentFor({
    propertyType: input.propertyType,
    tagSlugs: input.tagSlugs,
  });
  const scaled = scaleEstimateByPercent(input.lines, input.totals, percent);
  return {
    percent,
    lines: scaled.lines,
    totals: scaled.totals,
    baseTotals: input.totals,
    disclaimer: sanitizeDesignFeeDisclaimer(
      input.disclaimer ?? PUBLIC_DESIGN_DISCLAIMER,
    ),
  };
}
