import type { EstimateLine } from './estimates.types';

export type EstimateLineShareAnomalyKind = 'too_small' | 'too_large';

export interface EstimateLineShareAnomaly {
  trade: string;
  description: string;
  /** Share of total mid amount, 0–1. */
  share: number;
  kind: EstimateLineShareAnomalyKind;
  /** Threshold that was breached (0–1). */
  threshold: number;
  lineCount: number;
}

/** Max allowed share of any single line, or null when the rule does not apply. */
export function maxAllowedLineShare(lineCount: number): number | null {
  if (lineCount >= 10) return 0.3;
  if (lineCount >= 5) return 0.5;
  if (lineCount >= 3) return 0.7;
  return null;
}

export const MIN_LINE_SHARE_THRESHOLD = 0.01;

function lineMid(line: EstimateLine): number {
  return (Math.max(0, line.lineMin) + Math.max(0, line.lineMax)) / 2;
}

function scaleLineByFactor(line: EstimateLine, factor: number): EstimateLine {
  if (factor >= 1) {
    return line;
  }
  if (!(factor > 0)) {
    return {
      ...line,
      unitPriceMin: 0,
      unitPriceMax: 0,
      lineMin: 0,
      lineMax: 0,
    };
  }
  const unitPriceMin = Math.max(0, Math.round(line.unitPriceMin * factor));
  const unitPriceMax = Math.max(
    unitPriceMin,
    Math.round(line.unitPriceMax * factor),
  );
  const lineMin = Math.max(0, Math.round(line.lineMin * factor));
  const lineMax = Math.max(lineMin, Math.round(line.lineMax * factor));
  return {
    ...line,
    unitPriceMin,
    unitPriceMax,
    lineMin,
    lineMax,
  };
}

/**
 * Drops lines under 1% of the total mid amount (design-fee projects may keep them).
 */
export function dismissTinyEstimateLines(
  lines: EstimateLine[],
  options?: { allowTinyShare?: boolean },
): EstimateLine[] {
  if (options?.allowTinyShare || lines.length <= 1) {
    return lines;
  }

  const current = lines.map((line) => ({ ...line }));
  let changed = true;
  // Each pass removes at least one line, so this never binds — it exists so a
  // future change cannot turn the loop into a spin either.
  let passes = 0;
  const maxPasses = lines.length + 1;

  while (changed && current.length > 1 && passes < maxPasses) {
    passes += 1;
    changed = false;
    const totalMid = current.reduce((sum, line) => sum + lineMid(line), 0);
    if (!(totalMid > 0)) {
      break;
    }

    const keep = current.filter(
      (line) => lineMid(line) / totalMid >= MIN_LINE_SHARE_THRESHOLD,
    );
    if (keep.length === 0 || keep.length === current.length) {
      break;
    }
    current.splice(0, current.length, ...keep);
    changed = true;
  }

  return current;
}

/**
 * Scales down any line that exceeds the max share for the current line count.
 *
 * Rounding can make the required correction smaller than one baht: a line a hair
 * above the cap comes back unchanged after scaling. This loop used to keep going
 * in that case — a synchronous spin on a single-threaded node, which froze the
 * whole API process (production incident: the estimate recalculation stopped
 * answering for every user). A pass that changes nothing now ends the loop, and a
 * hard pass cap bounds the rest.
 */
export function capDominantEstimateLines(lines: EstimateLine[]): EstimateLine[] {
  if (lines.length < 3) {
    return lines;
  }

  const current = lines.map((line) => ({ ...line }));
  const maxPasses = lines.length * 4 + 8;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const mids = current.map(lineMid);
    const totalMid = mids.reduce((sum, value) => sum + value, 0);
    if (!(totalMid > 0)) {
      break;
    }

    const maxShare = maxAllowedLineShare(current.length);
    if (maxShare == null) {
      break;
    }

    let changed = false;

    for (let i = 0; i < current.length; i += 1) {
      const share = mids[i] / totalMid;
      if (share <= maxShare) {
        continue;
      }
      const otherMid = totalMid - mids[i];
      const targetMid = (maxShare * otherMid) / (1 - maxShare);
      /**
       * A line sitting a hair above the cap makes `targetMid` almost equal to its
       * own mid, so the factor comes out as 0.99999… (or, on a float edge, above 1).
       * Clamping keeps the correction real; the no-progress check below still ends
       * the loop when rounding cannot express it.
       */
      const factor = Math.min(0.99, targetMid / mids[i]);
      const scaled = scaleLineByFactor(current[i], factor);

      // Nothing moved: the overshoot is smaller than the rounding step, so stop
      // instead of spinning (this is what froze the API in production).
      if (
        scaled.lineMin === current[i].lineMin &&
        scaled.lineMax === current[i].lineMax &&
        scaled.unitPriceMin === current[i].unitPriceMin &&
        scaled.unitPriceMax === current[i].unitPriceMax
      ) {
        return current;
      }

      current[i] = scaled;
      changed = true;
      break;
    }

    if (!changed) {
      break;
    }
  }

  return current;
}

export function applyEstimateShareRules(
  lines: EstimateLine[],
  options?: { allowTinyShare?: boolean; capDominant?: boolean },
): EstimateLine[] {
  const dismissed = dismissTinyEstimateLines(lines, options);
  if (options?.capDominant) {
    return capDominantEstimateLines(dismissed);
  }
  return dismissed;
}

export function dominantLineShareAnomalies(
  lines: EstimateLine[],
  options?: { allowTinyShare?: boolean },
): EstimateLineShareAnomaly[] {
  return detectEstimateLineShareAnomalies(lines, options).filter(
    (anomaly) => anomaly.kind === 'too_large',
  );
}

/**
 * Detects suspicious cost distribution across estimate lines.
 *
 * - too_small: a line is under 1% of the total (skipped when allowTinyShare —
 *   e.g. design-fee wrap / design projects where tiny lines are expected).
 * - too_large: a line exceeds 70% (3+ lines), 50% (5+), or 30% (10+).
 */
export function detectEstimateLineShareAnomalies(
  lines: EstimateLine[],
  options?: { allowTinyShare?: boolean },
): EstimateLineShareAnomaly[] {
  if (lines.length === 0) {
    return [];
  }

  const mids = lines.map(lineMid);
  const totalMid = mids.reduce((sum, value) => sum + value, 0);
  if (!(totalMid > 0)) {
    return [];
  }

  const lineCount = lines.length;
  const maxShare = maxAllowedLineShare(lineCount);
  const allowTinyShare = Boolean(options?.allowTinyShare);
  const anomalies: EstimateLineShareAnomaly[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const share = mids[i] / totalMid;

    if (!allowTinyShare && share < MIN_LINE_SHARE_THRESHOLD) {
      anomalies.push({
        trade: line.trade,
        description: line.description,
        share,
        kind: 'too_small',
        threshold: MIN_LINE_SHARE_THRESHOLD,
        lineCount,
      });
    }

    if (maxShare != null && share > maxShare) {
      anomalies.push({
        trade: line.trade,
        description: line.description,
        share,
        kind: 'too_large',
        threshold: maxShare,
        lineCount,
      });
    }
  }

  return anomalies;
}

export function formatEstimateLineShareAnomaliesForPrompt(
  anomalies: EstimateLineShareAnomaly[],
): string[] {
  return anomalies.map((anomaly) => {
    const pct = Math.round(anomaly.share * 1000) / 10;
    const limitPct = Math.round(anomaly.threshold * 1000) / 10;
    if (anomaly.kind === 'too_small') {
      return `Line "${anomaly.trade}" (${anomaly.description.slice(0, 80)}) is only ~${pct}% of the total — below ${limitPct}%. Merge into a related trade or raise quantity/unit rates to a realistic share, or drop if out of scope.`;
    }
    return `Line "${anomaly.trade}" (${anomaly.description.slice(0, 80)}) is ~${pct}% of the total with ${anomaly.lineCount} lines — above the ${limitPct}% cap. Split or rebalance so no single line dominates; move excess into other confirmed trades.`;
  });
}
