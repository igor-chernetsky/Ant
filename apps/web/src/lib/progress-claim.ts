import { computeBidCostAdjustments } from '@/lib/bid-cost-adjustments';

function roundMoney(value: number): number {
  return Math.round(value);
}

export function computeRetentionPeriod(input: {
  worksPeriod: number;
  retentionPercent: number;
  retentionLimitPercent: number;
  contractGrandTotal: number;
  retentionHeldToDate: number;
}): number {
  const worksPeriod = Math.max(0, roundMoney(input.worksPeriod));
  const raw = roundMoney((worksPeriod * Math.max(0, input.retentionPercent)) / 100);
  const cap = roundMoney(
    (Math.max(0, input.contractGrandTotal) *
      Math.max(0, input.retentionLimitPercent)) /
      100,
  );
  const room = Math.max(0, cap - Math.max(0, input.retentionHeldToDate));
  return Math.min(raw, room);
}

/**
 * Advance payment recovery for one certificate — mirrors the API helper in
 * `progress-claim.util.ts`: deductions are made at the amortisation rate on the
 * certificate amount excluding VAT, capped by the advance still outstanding.
 */
export function computeAdvanceRecoveryPeriod(input: {
  /** Certificate amount for the period, excluding VAT. */
  base: number;
  percent: number;
  outstanding: number;
}): number {
  const base = Math.max(0, roundMoney(input.base));
  const percent = Math.max(0, input.percent);
  if (base <= 0 || percent <= 0) {
    return 0;
  }
  const raw = roundMoney((base * percent) / 100);
  return Math.min(raw, Math.max(0, roundMoney(input.outstanding)));
}

export function computeClaimPeriodTotals(input: {
  worksPeriod: number;
  preliminaryPercent: number;
  overheadProfitPercent: number;
  vatPercent: number;
  approvedGrandCumulative: number;
  worksCumulative: number;
  retentionPercent: number;
  retentionLimitPercent: number;
  contractGrandTotal: number;
  retentionHeldToDate: number;
  advanceRecoveryPercent: number;
  advanceOutstanding: number;
}) {
  const cum = computeBidCostAdjustments({
    worksSubtotal: input.worksCumulative,
    preliminaryPercent: input.preliminaryPercent,
    overheadProfitPercent: input.overheadProfitPercent,
    vatPercent: input.vatPercent,
  });
  const period = computeBidCostAdjustments({
    worksSubtotal: input.worksPeriod,
    preliminaryPercent: input.preliminaryPercent,
    overheadProfitPercent: input.overheadProfitPercent,
    vatPercent: input.vatPercent,
  });
  const grandPeriod = Math.max(0, cum.grandTotal - input.approvedGrandCumulative);
  const retentionPeriod = computeRetentionPeriod({
    worksPeriod: input.worksPeriod,
    retentionPercent: input.retentionPercent,
    retentionLimitPercent: input.retentionLimitPercent,
    contractGrandTotal: input.contractGrandTotal,
    retentionHeldToDate: input.retentionHeldToDate,
  });
  const advanceRecoveryPeriod = computeAdvanceRecoveryPeriod({
    base:
      input.worksPeriod +
      period.preliminaryAmount +
      period.overheadProfitAmount,
    percent: input.advanceRecoveryPercent,
    outstanding: input.advanceOutstanding,
  });
  return {
    worksPeriod: input.worksPeriod,
    preliminaryPeriod: period.preliminaryAmount,
    overheadProfitPeriod: period.overheadProfitAmount,
    vatPeriod: period.vatAmount,
    grandPeriod,
    grandCumulative: cum.grandTotal,
    retentionPeriod,
    advanceRecoveryPeriod,
    payablePeriod: Math.max(
      0,
      grandPeriod - retentionPeriod - advanceRecoveryPeriod,
    ),
  };
}
