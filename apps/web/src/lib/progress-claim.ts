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
  return {
    worksPeriod: input.worksPeriod,
    preliminaryPeriod: period.preliminaryAmount,
    overheadProfitPeriod: period.overheadProfitAmount,
    vatPeriod: period.vatAmount,
    grandPeriod,
    retentionPeriod,
    payablePeriod: Math.max(0, grandPeriod - retentionPeriod),
  };
}
