/**
 * Contractor platform fees (trial: listed amounts, 100% discount, nothing charged).
 *
 * Model:
 * - Platform access fee: USD 100 (credited toward success fee) — disclosed when the
 *   contractor signs the contract.
 * - Success fee: 2% of the awarded contract amount, minus the access-fee credit,
 *   due within one calendar month (typically after the contractor receives the
 *   client’s advance payment).
 * - Clients use the core platform for free until premium services are enabled.
 */

export const PLATFORM_ACCESS_FEE_USD = 100;
export const PLATFORM_SUCCESS_FEE_RATE = 0.02;
export const PLATFORM_FEES_TRIAL_ACTIVE = true;
export const PLATFORM_FEES_TRIAL_DISCOUNT_PERCENT = 100;

/** Indicative FX for displaying the USD access fee in THB. Not a live market rate. */
export const INDICATIVE_USD_THB_RATE = 36;

export type PlatformFeeAudience = 'client' | 'contractor';
export type PlatformFeeNoticeStep = 'sign';

export interface PlatformFeeQuote {
  contractAmount: number | null;
  currency: string;
  accessFeeUsd: number;
  accessFeeInCurrency: number | null;
  successFeeGross: number | null;
  accessFeeCredit: number | null;
  successFeeRemaining: number | null;
  dueNowListed: number;
  dueNowPayable: number;
  dueLaterListed: number | null;
  dueLaterPayable: number;
  trialActive: boolean;
  trialDiscountPercent: number;
  indicativeUsdThbRate: number;
}

function parseAmount(value: number | string | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function accessFeeInCurrency(currency: string): number | null {
  const code = currency.trim().toUpperCase() || 'THB';
  if (code === 'USD') {
    return PLATFORM_ACCESS_FEE_USD;
  }
  if (code === 'THB') {
    return PLATFORM_ACCESS_FEE_USD * INDICATIVE_USD_THB_RATE;
  }
  return null;
}

export function buildPlatformFeeQuote(input: {
  contractAmount?: number | string | null;
  currency?: string | null;
}): PlatformFeeQuote {
  const currency = (input.currency?.trim() || 'THB').toUpperCase();
  const contractAmount = parseAmount(input.contractAmount);
  const accessInCurrency = accessFeeInCurrency(currency);

  const successFeeGross =
    contractAmount != null
      ? Math.round(contractAmount * PLATFORM_SUCCESS_FEE_RATE * 100) / 100
      : null;

  const accessFeeCredit =
    successFeeGross != null && accessInCurrency != null
      ? Math.min(accessInCurrency, successFeeGross)
      : accessInCurrency;

  const successFeeRemaining =
    successFeeGross != null && accessFeeCredit != null
      ? Math.max(0, Math.round((successFeeGross - accessFeeCredit) * 100) / 100)
      : null;

  const dueNowListed = accessInCurrency ?? PLATFORM_ACCESS_FEE_USD;
  const dueLaterListed = successFeeRemaining;

  return {
    contractAmount,
    currency,
    accessFeeUsd: PLATFORM_ACCESS_FEE_USD,
    accessFeeInCurrency: accessInCurrency,
    successFeeGross,
    accessFeeCredit,
    successFeeRemaining,
    dueNowListed,
    dueNowPayable: PLATFORM_FEES_TRIAL_ACTIVE ? 0 : dueNowListed,
    dueLaterListed,
    dueLaterPayable:
      PLATFORM_FEES_TRIAL_ACTIVE || dueLaterListed == null ? 0 : dueLaterListed,
    trialActive: PLATFORM_FEES_TRIAL_ACTIVE,
    trialDiscountPercent: PLATFORM_FEES_TRIAL_DISCOUNT_PERCENT,
    indicativeUsdThbRate: INDICATIVE_USD_THB_RATE,
  };
}

export function formatPlatformMoney(
  amount: number,
  currency: string,
  locale: string,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatUsd(
  amount: number,
  locale: string,
): string {
  return formatPlatformMoney(amount, 'USD', locale);
}
