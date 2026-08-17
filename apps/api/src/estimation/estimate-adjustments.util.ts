import type { ProjectBriefV1 } from '../projects/project-brief';
import { scaleEstimateByPercent } from '../projects/design-fee-estimate';
import { computeTotals } from './ballpark-estimate.service';
import { resolveEstimateAreaSqm } from './estimate-scope.utils';
import { TH_REGIONAL_CATALOG } from './regional-catalog';
import type { EstimateLine, EstimateTotals } from './estimates.types';

export interface EstimateLineRef {
  trade: string;
  description: string;
}

export interface EstimateAdjustments {
  excludedLines: EstimateLineRef[];
  addedLines: EstimateLineRef[];
}

export interface EstimateAdjustmentsStored extends EstimateAdjustments {
  /** Fully priced client-added lines (cached after first price). */
  pricedAddedLines?: EstimateLine[];
}

export function emptyEstimateAdjustments(): EstimateAdjustments {
  return { excludedLines: [], addedLines: [] };
}

export function parseEstimateAdjustments(raw: unknown): EstimateAdjustmentsStored {
  if (!raw || typeof raw !== 'object') {
    return emptyEstimateAdjustments();
  }
  const obj = raw as {
    excludedLines?: unknown;
    addedLines?: unknown;
    pricedAddedLines?: unknown;
  };

  const excludedLines: EstimateLineRef[] = [];
  if (Array.isArray(obj.excludedLines)) {
    for (const row of obj.excludedLines) {
      if (!row || typeof row !== 'object') continue;
      const trade = String((row as { trade?: unknown }).trade ?? '').trim();
      const description = String(
        (row as { description?: unknown }).description ?? '',
      ).trim();
      if (!trade || !description) continue;
      excludedLines.push({ trade, description });
    }
  }

  const addedLines: EstimateLineRef[] = [];
  if (Array.isArray(obj.addedLines)) {
    for (const row of obj.addedLines) {
      if (!row || typeof row !== 'object') continue;
      const trade = String((row as { trade?: unknown }).trade ?? '').trim();
      const description = String(
        (row as { description?: unknown }).description ?? '',
      ).trim();
      if (!trade) continue;
      addedLines.push({ trade, description });
    }
  }

  const pricedAddedLines: EstimateLine[] = [];
  if (Array.isArray(obj.pricedAddedLines)) {
    for (const row of obj.pricedAddedLines) {
      const line = parseEstimateLine(row);
      if (line) pricedAddedLines.push(line);
    }
  }

  return {
    excludedLines,
    addedLines,
    ...(pricedAddedLines.length ? { pricedAddedLines } : {}),
  };
}

function parseEstimateLine(raw: unknown): EstimateLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const trade = String((raw as { trade?: unknown }).trade ?? '').trim();
  const description = String(
    (raw as { description?: unknown }).description ?? '',
  ).trim();
  if (!trade || !description) return null;
  const quantity = Number((raw as { quantity?: unknown }).quantity);
  const unitPriceMin = Number((raw as { unitPriceMin?: unknown }).unitPriceMin);
  const unitPriceMax = Number((raw as { unitPriceMax?: unknown }).unitPriceMax);
  const lineMin = Number((raw as { lineMin?: unknown }).lineMin);
  const lineMax = Number((raw as { lineMax?: unknown }).lineMax);
  const unit = String((raw as { unit?: unknown }).unit ?? '').trim();
  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(unitPriceMin) ||
    !Number.isFinite(unitPriceMax) ||
    !Number.isFinite(lineMin) ||
    !Number.isFinite(lineMax) ||
    !unit
  ) {
    return null;
  }
  return {
    trade,
    description,
    quantity,
    unit,
    unitPriceMin,
    unitPriceMax,
    lineMin,
    lineMax,
  };
}

export function lineIdentity(trade: string, description: string): string {
  const normalizedDescription = description
    .replace(/^Design:\s*/i, '')
    .trim()
    .toLowerCase();
  return `${trade.trim().toLowerCase()}::${normalizedDescription}`;
}

function isLineExcluded(
  line: EstimateLineRef,
  excludedLines: EstimateLineRef[],
): boolean {
  const key = lineIdentity(line.trade, line.description);
  return excludedLines.some(
    (excluded) => lineIdentity(excluded.trade, excluded.description) === key,
  );
}

export { isLineExcluded };

export const MAX_ESTIMATE_LINE_AMOUNT_THB = 500_000_000;

export type LinePriceRangeError =
  | 'invalid'
  | 'negative'
  | 'max_lt_min'
  | 'too_large';

export function validateLinePriceRange(
  lineMin: number,
  lineMax: number,
): LinePriceRangeError | null {
  if (!Number.isFinite(lineMin) || !Number.isFinite(lineMax)) {
    return 'invalid';
  }
  if (!Number.isInteger(lineMin) || !Number.isInteger(lineMax)) {
    return 'invalid';
  }
  if (lineMin < 0 || lineMax < 0) {
    return 'negative';
  }
  if (lineMax < lineMin) {
    return 'max_lt_min';
  }
  if (
    lineMin > MAX_ESTIMATE_LINE_AMOUNT_THB ||
    lineMax > MAX_ESTIMATE_LINE_AMOUNT_THB
  ) {
    return 'too_large';
  }
  return null;
}

export function priceCatalogEstimateLine(input: {
  trade: string;
  description?: string;
  brief: ProjectBriefV1;
  narrative?: string;
}): EstimateLine | null {
  const catalog = TH_REGIONAL_CATALOG.find(
    (item) => item.trade === input.trade.trim(),
  );
  if (!catalog) {
    return null;
  }

  const areaSqm = resolveEstimateAreaSqm(
    input.brief,
    input.narrative ?? '',
  );
  const quantity =
    catalog.unit === 'sqm' ? areaSqm : catalog.unit === 'point' ? 1 : 1;
  const lineMin = Math.round(
    catalog.priceMinThb * (catalog.unit === 'sqm' ? areaSqm : quantity),
  );
  const lineMax = Math.round(
    catalog.priceMaxThb * (catalog.unit === 'sqm' ? areaSqm : quantity),
  );

  return {
    trade: catalog.trade,
    description: input.description?.trim() || catalog.label,
    quantity,
    unit: catalog.unit,
    unitPriceMin: catalog.priceMinThb,
    unitPriceMax: catalog.priceMaxThb,
    lineMin,
    lineMax,
  };
}

export function buildAddedEstimateLine(input: {
  trade: string;
  description?: string;
  brief: ProjectBriefV1;
  narrative?: string;
  lineMin: number;
  lineMax: number;
}): EstimateLine | null {
  const catalogLine = priceCatalogEstimateLine({
    trade: input.trade,
    description: input.description,
    brief: input.brief,
    narrative: input.narrative,
  });
  if (!catalogLine) {
    return null;
  }

  const rangeError = validateLinePriceRange(input.lineMin, input.lineMax);
  if (rangeError) {
    return null;
  }

  const quantity = catalogLine.quantity > 0 ? catalogLine.quantity : 1;
  const lineMin = input.lineMin;
  const lineMax = input.lineMax;

  return {
    ...catalogLine,
    description: input.description?.trim() || catalogLine.description,
    lineMin,
    lineMax,
    unitPriceMin: Math.max(0, Math.round(lineMin / quantity)),
    unitPriceMax: Math.max(
      Math.round(lineMin / quantity),
      Math.round(lineMax / quantity),
    ),
  };
}

export function catalogTradesForPicker(): Array<{ trade: string; label: string }> {
  return TH_REGIONAL_CATALOG.map((item) => ({
    trade: item.trade,
    label: item.label,
  }));
}

export function catalogTradesForPickerWithPrices(
  brief: ProjectBriefV1,
  narrative?: string,
): Array<{ trade: string; label: string; lineMin: number; lineMax: number }> {
  return TH_REGIONAL_CATALOG.map((item) => {
    const priced = priceCatalogEstimateLine({
      trade: item.trade,
      brief,
      narrative,
    });
    return {
      trade: item.trade,
      label: item.label,
      lineMin: priced?.lineMin ?? 0,
      lineMax: priced?.lineMax ?? 0,
    };
  });
}

export function filterLinesExcludedByClient(
  lines: EstimateLine[],
  excludedLines: EstimateLineRef[],
): EstimateLine[] {
  if (excludedLines.length === 0) {
    return lines;
  }
  return lines.filter(
    (line) =>
      !isLineExcluded(
        { trade: line.trade, description: line.description },
        excludedLines,
      ),
  );
}

export function applyEstimateAdjustments(input: {
  lines: EstimateLine[];
  adjustments: EstimateAdjustmentsStored;
  brief: ProjectBriefV1;
  narrative?: string;
  designFeePercent?: number | null;
  isDesignProject?: boolean;
}): { lines: EstimateLine[]; totals: EstimateTotals } {
  const filtered = input.lines.filter(
    (line) =>
      !isLineExcluded(
        { trade: line.trade, description: line.description },
        input.adjustments.excludedLines,
      ),
  );

  const presentTrades = new Set(filtered.map((line) => line.trade.trim()));

  const pricedAdded: EstimateLine[] = [];
  for (const ref of input.adjustments.addedLines) {
    if (presentTrades.has(ref.trade.trim())) {
      continue;
    }
    const cached = input.adjustments.pricedAddedLines?.find(
      (line) => lineIdentity(line.trade, line.description) === lineIdentity(ref.trade, ref.description || ref.trade),
    );
    if (cached) {
      pricedAdded.push(cached);
      continue;
    }
    const priced = priceCatalogEstimateLine({
      trade: ref.trade,
      description: ref.description,
      brief: input.brief,
      narrative: input.narrative,
    });
    if (priced) {
      pricedAdded.push(priced);
      presentTrades.add(ref.trade.trim());
    }
  }

  let merged = [...filtered, ...pricedAdded];
  let totals = computeTotals(merged);

  if (
    input.isDesignProject &&
    input.designFeePercent != null &&
    input.designFeePercent > 0
  ) {
    const scaled = scaleEstimateByPercent(
      merged,
      totals,
      input.designFeePercent,
    );
    merged = scaled.lines;
    totals = scaled.totals;
  }

  return { lines: merged, totals };
}

export function mergeEstimateAdjustments(
  current: EstimateAdjustmentsStored,
  patch: EstimateAdjustments,
): EstimateAdjustmentsStored {
  return {
    excludedLines: patch.excludedLines,
    addedLines: patch.addedLines,
  };
}
