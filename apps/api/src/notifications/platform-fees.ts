/**
 * Platform fee constants (contractor-paid success fee).
 * Keep in sync with apps/web/src/lib/platform-fees.ts and legal docs.
 */
export const PLATFORM_ACCESS_FEE_USD = 20;
export const PLATFORM_SUCCESS_FEE_RATE = 0.02;
/**
 * Fallback trial state, used only while no end date is configured in
 * Admin → Settings (`PlatformSettings.trialEndsAt`). Once a date is set it wins
 * and the trial ends on its own.
 */
export const PLATFORM_FEES_TRIAL_ACTIVE = true;
export const PLATFORM_FEES_TRIAL_DISCOUNT_PERCENT = 100;
export const INDICATIVE_USD_THB_RATE = 36;

/** Default admin inbox from legal branding (LEGAL_CONTACT_EMAIL). Used when DB list is empty; override with PLATFORM_ADMIN_EMAIL. */
export const DEFAULT_PLATFORM_ADMIN_EMAIL = 'hello@builthai.com';

/**
 * Whether the free trial is running.
 *
 * `null`/`undefined` means no date is configured, which keeps the previous
 * behaviour of the compile-time flag. A configured date wins.
 */
export function resolveTrialActive(
  trialEndsAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!trialEndsAt) {
    return PLATFORM_FEES_TRIAL_ACTIVE;
  }
  const end = trialEndsAt.getTime();
  if (!Number.isFinite(end)) {
    return PLATFORM_FEES_TRIAL_ACTIVE;
  }
  return now.getTime() <= end;
}

/**
 * Converts a `YYYY-MM-DD` value from the admin date picker into the last instant
 * of that day (UTC), so the whole selected day still counts as trial.
 *
 * Returns `null` for an empty value (clears the date) and throws for anything
 * that is not a real calendar date.
 */
export function parseTrialEndDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('trialEndsAt must be a YYYY-MM-DD date');
  }
  const parsed = new Date(`${trimmed}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('trialEndsAt is not a valid date');
  }
  // Reject impossible calendar dates such as 2026-02-31.
  if (parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new Error('trialEndsAt is not a valid date');
  }
  return parsed;
}

/** `YYYY-MM-DD` for a stored instant, for date inputs and API responses. */
export function trialEndDateOnly(trialEndsAt: Date | null): string | null {
  return trialEndsAt ? trialEndsAt.toISOString().slice(0, 10) : null;
}

export function platformSuccessFeeAmount(contractAmount: number): number {
  return Math.round(contractAmount * PLATFORM_SUCCESS_FEE_RATE * 100) / 100;
}

function accessFeeInCurrency(currency: string): number | null {
  const code = currency.trim().toUpperCase() || 'THB';
  if (code === 'USD') return PLATFORM_ACCESS_FEE_USD;
  if (code === 'THB') return PLATFORM_ACCESS_FEE_USD * INDICATIVE_USD_THB_RATE;
  return null;
}

/**
 * Due now = min($20 access fee, 2% success fee) when both known.
 * Matches contractor agreement: if total fee < $20, pay only the fee.
 */
export function buildPlatformFeeSnapshot(input: {
  contractAmount?: number | null;
  currency?: string | null;
  /** Resolved trial state; omit to fall back to PLATFORM_FEES_TRIAL_ACTIVE. */
  trialActive?: boolean;
}): {
  currency: string;
  contractAmount: number | null;
  accessFeeUsd: number;
  dueNowListed: number | null;
  dueNowPayable: number;
  successFeeGross: number | null;
  trialActive: boolean;
} {
  const currency = (input.currency?.trim() || 'THB').toUpperCase();
  const contractAmount =
    input.contractAmount != null &&
    Number.isFinite(input.contractAmount) &&
    input.contractAmount > 0
      ? input.contractAmount
      : null;
  const accessInCurrency = accessFeeInCurrency(currency);
  const successFeeGross =
    contractAmount != null ? platformSuccessFeeAmount(contractAmount) : null;
  const listedCap = accessInCurrency ?? PLATFORM_ACCESS_FEE_USD;
  const dueNowListed =
    successFeeGross != null
      ? Math.min(listedCap, successFeeGross)
      : listedCap;

  const trialActive = input.trialActive ?? PLATFORM_FEES_TRIAL_ACTIVE;

  return {
    currency,
    contractAmount,
    accessFeeUsd: PLATFORM_ACCESS_FEE_USD,
    dueNowListed,
    dueNowPayable: trialActive ? 0 : dueNowListed,
    successFeeGross,
    trialActive,
  };
}
