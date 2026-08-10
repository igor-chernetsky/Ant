import type { BidTerms } from '@/lib/tendering';

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
  worksSubtotal: number;
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

export function bidWorksSubtotalForCompare(
  terms: BidTerms | null | undefined,
  amount: number,
): number {
  const stored = terms?.costAdjustments?.worksSubtotal;
  if (stored != null && Number.isFinite(stored) && stored > 0) {
    return stored;
  }
  return amount;
}

export function initialCostAdjustmentPercents(
  terms: BidTerms | null | undefined,
): {
  preliminaryPercent: string;
  overheadProfitPercent: string;
  vatPercent: string;
} {
  const adj = terms?.costAdjustments;
  if (adj) {
    return {
      preliminaryPercent: String(adj.preliminaryPercent ?? 0),
      overheadProfitPercent: String(adj.overheadProfitPercent ?? 0),
      vatPercent: String(adj.vatPercent ?? 0),
    };
  }
  if (terms != null) {
    return {
      preliminaryPercent: '0',
      overheadProfitPercent: '0',
      vatPercent: '0',
    };
  }
  return {
    preliminaryPercent: '0',
    overheadProfitPercent: '0',
    vatPercent: String(DEFAULT_VAT_PERCENT),
  };
}

export function initialWorksAmount(
  amount: string | number | null | undefined,
  terms: BidTerms | null | undefined,
): string {
  const adj = terms?.costAdjustments;
  if (adj?.worksSubtotal != null) {
    return String(adj.worksSubtotal);
  }
  if (amount != null && amount !== '') {
    return String(amount);
  }
  return '';
}
