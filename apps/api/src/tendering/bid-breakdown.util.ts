import { BadRequestException } from '@nestjs/common';

export const BREAKDOWN_TOTAL_TOLERANCE_THB = 1;

export const BREAKDOWN_TOTAL_MISMATCH_MESSAGE =
  'Breakdown subtotal does not match the total. Please check your calculations.';

export function assertBreakdownMatchesTotal(
  amount: number,
  lineItems?: Array<{ amount: number }>,
): void {
  if (!lineItems?.length) {
    return;
  }

  const subtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  if (Math.abs(subtotal - amount) > BREAKDOWN_TOTAL_TOLERANCE_THB) {
    throw new BadRequestException(BREAKDOWN_TOTAL_MISMATCH_MESSAGE);
  }
}
