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

function isExcluded(
  line: EstimateLineRef,
  excludedLines: EstimateLineRef[],
): boolean {
  const key = lineIdentity(line.trade, line.description);
  return excludedLines.some(
    (excluded) => lineIdentity(excluded.trade, excluded.description) === key,
  );
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

export function catalogTradesForPicker(): Array<{ trade: string; label: string }> {
  return TH_REGIONAL_CATALOG.map((item) => ({
    trade: item.trade,
    label: item.label,
  }));
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
      !isExcluded(
        { trade: line.trade, description: line.description },
        input.adjustments.excludedLines,
      ),
  );

  const pricedAdded: EstimateLine[] = [];
  for (const ref of input.adjustments.addedLines) {
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
