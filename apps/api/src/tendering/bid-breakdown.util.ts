import { BadRequestException } from '@nestjs/common';
import type { BidCostAdjustmentsInput } from './tendering.types';
import {
  COST_ADJUSTMENT_TOLERANCE_THB,
  computeBidCostAdjustments,
} from './bid-cost-adjustments.util';

export const BREAKDOWN_TOTAL_TOLERANCE_THB = 1;

export const BREAKDOWN_TOTAL_MISMATCH_MESSAGE =
  'Breakdown subtotal does not match the total. Please check your calculations.';

export const BID_PRICING_MISMATCH_MESSAGE =
  'Bid amount does not match works total and price adjustments. Please check your calculations.';

function breakdownSubtotal(lineItems: Array<{ amount: number }>): number {
  return lineItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
}

function assertPercent(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new BadRequestException(`${name} must be between 0 and 100`);
  }
}

export function assertBreakdownMatchesTotal(
  amount: number,
  lineItems?: Array<{ amount: number }>,
): void {
  if (!lineItems?.length) {
    return;
  }

  const subtotal = breakdownSubtotal(lineItems);
  if (Math.abs(subtotal - amount) > BREAKDOWN_TOTAL_TOLERANCE_THB) {
    throw new BadRequestException(BREAKDOWN_TOTAL_MISMATCH_MESSAGE);
  }
}

export function assertBidPricing(
  amount: number,
  lineItems?: Array<{ amount: number }>,
  costAdjustments?: BidCostAdjustmentsInput,
): void {
  if (!costAdjustments) {
    assertBreakdownMatchesTotal(amount, lineItems);
    return;
  }

  assertPercent('Preliminary', costAdjustments.preliminaryPercent);
  assertPercent('Overhead & profit', costAdjustments.overheadProfitPercent);
  assertPercent('VAT', costAdjustments.vatPercent);

  let worksSubtotal: number;
  if (lineItems?.length) {
    worksSubtotal = breakdownSubtotal(lineItems);
    if (
      costAdjustments.worksSubtotal != null &&
      Math.abs(costAdjustments.worksSubtotal - worksSubtotal) >
        BREAKDOWN_TOTAL_TOLERANCE_THB
    ) {
      throw new BadRequestException(BREAKDOWN_TOTAL_MISMATCH_MESSAGE);
    }
  } else {
    worksSubtotal = Number(costAdjustments.worksSubtotal);
    if (!Number.isFinite(worksSubtotal) || worksSubtotal <= 0) {
      throw new BadRequestException('Works total must be a positive number');
    }
  }

  const computed = computeBidCostAdjustments({
    worksSubtotal,
    preliminaryPercent: costAdjustments.preliminaryPercent,
    overheadProfitPercent: costAdjustments.overheadProfitPercent,
    vatPercent: costAdjustments.vatPercent,
  });

  if (
    Math.abs(computed.grandTotal - amount) > COST_ADJUSTMENT_TOLERANCE_THB
  ) {
    throw new BadRequestException(BID_PRICING_MISMATCH_MESSAGE);
  }
}
