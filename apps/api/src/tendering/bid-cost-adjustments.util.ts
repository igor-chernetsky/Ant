export const DEFAULT_VAT_PERCENT = 7;
export const COST_ADJUSTMENT_TOLERANCE_THB = 1;

export interface BidCostAdjustments {
  preliminaryPercent: number;
  overheadProfitPercent: number;
  vatPercent: number;
  worksSubtotal: number;
  preliminaryAmount: number;
  overheadProfitAmount: number;
  vatAmount: number;
}

export interface BidCostAdjustmentsInput {
  preliminaryPercent: number;
  overheadProfitPercent: number;
  vatPercent: number;
  worksSubtotal?: number;
}

export interface BidCostAdjustmentResult extends BidCostAdjustments {
  taxableSubtotal: number;
  grandTotal: number;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function computeBidCostAdjustments(input: {
  worksSubtotal: number;
  preliminaryPercent: number;
  overheadProfitPercent: number;
  vatPercent: number;
}): BidCostAdjustmentResult {
  const worksSubtotal = Math.round(input.worksSubtotal);
  const preliminaryPercent = clampPercent(input.preliminaryPercent);
  const overheadProfitPercent = clampPercent(input.overheadProfitPercent);
  const vatPercent = clampPercent(input.vatPercent);

  const preliminaryAmount = Math.round((worksSubtotal * preliminaryPercent) / 100);
  const overheadProfitAmount = Math.round(
    (worksSubtotal * overheadProfitPercent) / 100,
  );
  const taxableSubtotal =
    worksSubtotal + preliminaryAmount + overheadProfitAmount;
  const vatAmount = Math.round((taxableSubtotal * vatPercent) / 100);
  const grandTotal = taxableSubtotal + vatAmount;

  return {
    worksSubtotal,
    preliminaryPercent,
    overheadProfitPercent,
    vatPercent,
    preliminaryAmount,
    overheadProfitAmount,
    vatAmount,
    taxableSubtotal,
    grandTotal,
  };
}

export function buildStoredCostAdjustments(
  input: BidCostAdjustmentsInput & { worksSubtotal: number },
): BidCostAdjustments {
  const computed = computeBidCostAdjustments({
    worksSubtotal: input.worksSubtotal,
    preliminaryPercent: input.preliminaryPercent,
    overheadProfitPercent: input.overheadProfitPercent,
    vatPercent: input.vatPercent,
  });

  return {
    worksSubtotal: computed.worksSubtotal,
    preliminaryPercent: computed.preliminaryPercent,
    overheadProfitPercent: computed.overheadProfitPercent,
    vatPercent: computed.vatPercent,
    preliminaryAmount: computed.preliminaryAmount,
    overheadProfitAmount: computed.overheadProfitAmount,
    vatAmount: computed.vatAmount,
  };
}

export function bidWorksSubtotalForCompare(
  terms: { costAdjustments?: BidCostAdjustments | null } | null | undefined,
  amount: number,
): number {
  const stored = terms?.costAdjustments?.worksSubtotal;
  if (stored != null && Number.isFinite(stored) && stored > 0) {
    return stored;
  }
  return amount;
}
