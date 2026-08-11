import { computeBidCostAdjustments } from '../tendering/bid-cost-adjustments.util';

export interface ProgressBaselineLine {
  trade: string;
  description?: string;
  contractAmount: number;
  /** Last approved cumulative percent (0–100). */
  approvedPercent: number;
  approvedAmount: number;
}

export interface ProgressLineInput {
  trade: string;
  description?: string;
  contractAmount: number;
  percentComplete: number;
  amountPreviouslyApproved: number;
}

export interface ProgressLineComputed extends ProgressLineInput {
  amountCumulative: number;
  amountPeriod: number;
}

export interface ProgressClaimTotals {
  worksCumulative: number;
  preliminaryCumulative: number;
  overheadProfitCumulative: number;
  vatCumulative: number;
  grandCumulative: number;
  worksPeriod: number;
  preliminaryPeriod: number;
  overheadProfitPeriod: number;
  vatPeriod: number;
  grandPeriod: number;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function roundMoney(value: number): number {
  return Math.round(value);
}

export function computeLineAmounts(input: {
  contractAmount: number;
  percentComplete: number;
  amountPreviouslyApproved: number;
}): { amountCumulative: number; amountPeriod: number } {
  const percent = clampPercent(input.percentComplete);
  const contractAmount = Math.max(0, roundMoney(input.contractAmount));
  const amountCumulative = roundMoney((contractAmount * percent) / 100);
  const previously = Math.max(0, roundMoney(input.amountPreviouslyApproved));
  const amountPeriod = Math.max(0, amountCumulative - previously);
  return { amountCumulative, amountPeriod };
}

export function computeProgressClaim(
  lines: ProgressLineInput[],
  adjustments: {
    preliminaryPercent: number;
    overheadProfitPercent: number;
    vatPercent: number;
  },
  previousGrandCumulative = 0,
): { lines: ProgressLineComputed[]; totals: ProgressClaimTotals } {
  const computedLines: ProgressLineComputed[] = lines.map((line) => {
    const amounts = computeLineAmounts(line);
    return {
      ...line,
      percentComplete: clampPercent(line.percentComplete),
      contractAmount: Math.max(0, roundMoney(line.contractAmount)),
      amountPreviouslyApproved: Math.max(
        0,
        roundMoney(line.amountPreviouslyApproved),
      ),
      ...amounts,
    };
  });

  const worksCumulative = computedLines.reduce(
    (sum, line) => sum + line.amountCumulative,
    0,
  );
  const worksPeriod = computedLines.reduce(
    (sum, line) => sum + line.amountPeriod,
    0,
  );

  const cumulativeAdj = computeBidCostAdjustments({
    worksSubtotal: worksCumulative,
    preliminaryPercent: adjustments.preliminaryPercent,
    overheadProfitPercent: adjustments.overheadProfitPercent,
    vatPercent: adjustments.vatPercent,
  });

  const grandCumulative = cumulativeAdj.grandTotal;
  const previousGrand = Math.max(0, roundMoney(previousGrandCumulative));
  const grandPeriod = Math.max(0, grandCumulative - previousGrand);

  // Derive period adjustment components so they sum to grandPeriod.
  const periodAdj = computeBidCostAdjustments({
    worksSubtotal: worksPeriod,
    preliminaryPercent: adjustments.preliminaryPercent,
    overheadProfitPercent: adjustments.overheadProfitPercent,
    vatPercent: adjustments.vatPercent,
  });

  let preliminaryPeriod = periodAdj.preliminaryAmount;
  let overheadProfitPeriod = periodAdj.overheadProfitAmount;
  let vatPeriod = periodAdj.vatAmount;
  const periodSum =
    worksPeriod + preliminaryPeriod + overheadProfitPeriod + vatPeriod;
  const drift = grandPeriod - periodSum;
  if (drift !== 0) {
    vatPeriod += drift;
  }

  return {
    lines: computedLines,
    totals: {
      worksCumulative: cumulativeAdj.worksSubtotal,
      preliminaryCumulative: cumulativeAdj.preliminaryAmount,
      overheadProfitCumulative: cumulativeAdj.overheadProfitAmount,
      vatCumulative: cumulativeAdj.vatAmount,
      grandCumulative,
      worksPeriod,
      preliminaryPeriod,
      overheadProfitPeriod,
      vatPeriod,
      grandPeriod,
    },
  };
}
