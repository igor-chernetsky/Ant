import type { BallparkEstimate, EstimateLine } from '@/lib/estimate';

/** Matches API CORE_SCOPE_TRADES — warn before client excludes these. */
export const CORE_ESTIMATE_TRADES = new Set([
  'structural',
  'finishing',
  'electrical',
  'plumbing',
  'roofing',
  'demolition',
  'hvac',
  'windows-doors',
  'tiling',
  'flooring',
  'painting',
  'fire-suppression',
  'piling',
  'earthwork',
  'low-voltage',
  'built-in-furniture',
  'plastering',
  'ceilings',
]);

export function estimateLineKey(line: {
  trade: string;
  description: string;
}): string {
  const normalizedDescription = line.description
    .replace(/^Design:\s*/i, '')
    .trim()
    .toLowerCase();
  return `${line.trade.trim().toLowerCase()}::${normalizedDescription}`;
}

export function isCoreEstimateTrade(trade: string): boolean {
  return CORE_ESTIMATE_TRADES.has(trade.trim().toLowerCase());
}

export interface RepricedAdditionDiff {
  trade: string;
  description: string;
  previousMin: number;
  previousMax: number;
  nextMin: number;
  nextMax: number;
}

export interface RemovedLineDiff {
  trade: string;
  description: string;
  previousMin: number;
  previousMax: number;
}

export interface EstimateRecalcDiff {
  stillExcluded: Array<{ trade: string; description: string }>;
  repricedAdditions: RepricedAdditionDiff[];
  newSuggestions: EstimateLine[];
  removedFromEstimate: RemovedLineDiff[];
  totalsDelta: {
    previousMid: number;
    nextMid: number;
  };
}

function addedLineKeys(estimate: BallparkEstimate): Set<string> {
  return new Set(
    (estimate.adjustments?.addedLines ?? []).map((line) =>
      estimateLineKey({
        trade: line.trade,
        description: line.description || line.trade,
      }),
    ),
  );
}

function addedTrades(estimate: BallparkEstimate): Set<string> {
  return new Set(
    (estimate.adjustments?.addedLines ?? []).map((line) =>
      line.trade.trim().toLowerCase(),
    ),
  );
}

export function computeEstimateRecalcDiff(
  previous: BallparkEstimate,
  next: BallparkEstimate,
): EstimateRecalcDiff | null {
  const previousByKey = new Map(
    previous.lines.map((line) => [estimateLineKey(line), line]),
  );
  const nextByKey = new Map(
    next.lines.map((line) => [estimateLineKey(line), line]),
  );
  const previousAddedTrades = addedTrades(previous);

  const stillExcluded = next.adjustments?.excludedLines ?? [];

  const repricedAdditions: RepricedAdditionDiff[] = [];
  const repricedTrades = new Set<string>();

  for (const ref of previous.adjustments?.addedLines ?? []) {
    const prevLine =
      previous.lines.find((line) => line.trade === ref.trade) ??
      previousByKey.get(
        estimateLineKey({
          trade: ref.trade,
          description: ref.description || ref.trade,
        }),
      );
    const nextLine = next.lines.find((line) => line.trade === ref.trade);
    if (!prevLine || !nextLine) continue;
    if (
      prevLine.lineMin === nextLine.lineMin &&
      prevLine.lineMax === nextLine.lineMax
    ) {
      continue;
    }
    repricedTrades.add(ref.trade.trim().toLowerCase());
    repricedAdditions.push({
      trade: nextLine.trade,
      description: nextLine.description,
      previousMin: prevLine.lineMin,
      previousMax: prevLine.lineMax,
      nextMin: nextLine.lineMin,
      nextMax: nextLine.lineMax,
    });
  }

  for (const [key, prevLine] of previousByKey) {
    if (previousAddedTrades.has(prevLine.trade.trim().toLowerCase())) {
      continue;
    }
    const nextLine = nextByKey.get(key);
    if (!nextLine) continue;
    if (
      prevLine.lineMin === nextLine.lineMin &&
      prevLine.lineMax === nextLine.lineMax
    ) {
      continue;
    }
    repricedAdditions.push({
      trade: nextLine.trade,
      description: nextLine.description,
      previousMin: prevLine.lineMin,
      previousMax: prevLine.lineMax,
      nextMin: nextLine.lineMin,
      nextMax: nextLine.lineMax,
    });
  }

  const newSuggestions = next.lines.filter((line) => {
    const key = estimateLineKey(line);
    if (previousByKey.has(key)) return false;
    if (previousAddedTrades.has(line.trade.trim().toLowerCase())) {
      return false;
    }
    if (repricedTrades.has(line.trade.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  const previousAddedKeys = addedLineKeys(previous);
  const removedFromEstimate: RemovedLineDiff[] = previous.lines
    .filter((line) => {
      const key = estimateLineKey(line);
      if (nextByKey.has(key)) return false;
      if (previousAddedKeys.has(key)) return false;
      return true;
    })
    .map((line) => ({
      trade: line.trade,
      description: line.description,
      previousMin: line.lineMin,
      previousMax: line.lineMax,
    }));

  const totalsDelta = {
    previousMid: previous.totals.midAmount,
    nextMid: next.totals.midAmount,
  };

  const hasChanges =
    stillExcluded.length > 0 ||
    repricedAdditions.length > 0 ||
    newSuggestions.length > 0 ||
    removedFromEstimate.length > 0 ||
    totalsDelta.previousMid !== totalsDelta.nextMid;

  if (!hasChanges) {
    return null;
  }

  return {
    stillExcluded,
    repricedAdditions,
    newSuggestions,
    removedFromEstimate,
    totalsDelta,
  };
}

export function hasCoreTradeExclusions(
  excludedLines: Array<{ trade: string; description: string }>,
): boolean {
  return excludedLines.some((line) => isCoreEstimateTrade(line.trade));
}
