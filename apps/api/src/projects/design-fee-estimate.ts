import type { EstimateLine, EstimateTotals } from '../estimation/estimates.types';
import { designFeePercentFor } from './design-permits.utils';
import type { PropertyType } from '@prisma/client';

function roundMoney(value: number): number {
  return Math.round(value);
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
      description: line.description.startsWith('Design:')
        ? line.description
        : `Design: ${line.description}`,
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
    disclaimer:
      input.disclaimer ??
      `Design fee ballpark (${percent}% of estimated construction works). Construction amounts are not shown at this stage.`,
  };
}
