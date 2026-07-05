import type { BidLineItem } from '@/lib/tendering';

export const BREAKDOWN_TOTAL_TOLERANCE_THB = 1;

export const BREAKDOWN_TOTAL_MISMATCH_MESSAGE =
  'Breakdown subtotal does not match the total. Please check your calculations.';

export function activeBreakdownLineItems(lineItems: BidLineItem[]): BidLineItem[] {
  return lineItems.filter(
    (item) =>
      item.trade.trim() ||
      (item.description?.trim() ?? '') ||
      item.amount > 0,
  );
}

export function breakdownLineItemsSubtotal(items: BidLineItem[]): number {
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

export function breakdownTotalsMismatch(
  total: number,
  lineItems: BidLineItem[],
): boolean {
  if (lineItems.length === 0) {
    return false;
  }
  if (!Number.isFinite(total) || total <= 0) {
    return false;
  }
  const subtotal = breakdownLineItemsSubtotal(lineItems);
  return Math.abs(subtotal - total) > BREAKDOWN_TOTAL_TOLERANCE_THB;
}
