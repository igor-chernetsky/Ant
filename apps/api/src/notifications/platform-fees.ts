/**
 * Platform fee constants (contractor-paid success fee).
 * Keep in sync with apps/web/src/lib/platform-fees.ts and legal docs.
 */
export const PLATFORM_ACCESS_FEE_USD = 20;
export const PLATFORM_SUCCESS_FEE_RATE = 0.02;
export const PLATFORM_FEES_TRIAL_ACTIVE = true;
export const INDICATIVE_USD_THB_RATE = 36;

/** Default admin inbox from legal branding (LEGAL_CONTACT_EMAIL). Used when DB list is empty; override with PLATFORM_ADMIN_EMAIL. */
export const DEFAULT_PLATFORM_ADMIN_EMAIL = 'providercmp@gmail.com';

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

  return {
    currency,
    contractAmount,
    accessFeeUsd: PLATFORM_ACCESS_FEE_USD,
    dueNowListed,
    dueNowPayable: PLATFORM_FEES_TRIAL_ACTIVE ? 0 : dueNowListed,
    successFeeGross,
    trialActive: PLATFORM_FEES_TRIAL_ACTIVE,
  };
}
