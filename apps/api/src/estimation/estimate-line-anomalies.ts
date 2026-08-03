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

const MIN_SHARE_THRESHOLD = 0.01;

function lineMid(line: EstimateLine): number {
  return (Math.max(0, line.lineMin) + Math.max(0, line.lineMax)) / 2;
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

    if (!allowTinyShare && share < MIN_SHARE_THRESHOLD) {
      anomalies.push({
        trade: line.trade,
        description: line.description,
        share,
        kind: 'too_small',
        threshold: MIN_SHARE_THRESHOLD,
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
