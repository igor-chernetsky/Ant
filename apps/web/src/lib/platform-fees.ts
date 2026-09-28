/**
 * Contractor platform fees (trial: listed amounts, 100% discount, nothing charged).
 *
 * Model:
 * - Platform access / signing fee: USD 20 (or 2% of contract if 2% is lower),
 *   credited toward the success fee — disclosed before the contractor signs.
 * - Success fee: 2% of the awarded contract amount, minus the access-fee credit,
 *   due within two weeks (typically after the contractor receives the
 *   client’s advance payment).
 * - Clients use the core platform for free until premium services are enabled.
 *
 * The trial end date is configured by an admin (`PlatformSettings.trialEndsAt`)
 * and read from `GET /api/public/platform-fees`; the constants below are only a
 * fallback for the moment before that request resolves. The amounts actually
 * charged are computed and stored server-side when a signature request is
 * created.
 */

export const PLATFORM_ACCESS_FEE_USD = 20;
export const PLATFORM_SUCCESS_FEE_RATE = 0.02;
/** Fallback while no admin-configured end date is known. */
export const PLATFORM_FEES_TRIAL_ACTIVE = true;
export const PLATFORM_FEES_TRIAL_DISCOUNT_PERCENT = 100;

/** Indicative FX for displaying the USD access fee in THB. Not a live market rate. */
export const INDICATIVE_USD_THB_RATE = 36;

export interface PlatformFeeTrialState {
  trialActive: boolean;
  /** Calendar day the trial ends on (`YYYY-MM-DD`), or null when unset. */
  trialEndsAt: string | null;
}

let trialStateRequest: Promise<PlatformFeeTrialState> | null = null;

/**
 * Trial state from the API, shared by every caller through one in-flight
 * request. Falls back to the constants when the endpoint is unreachable, so the
 * UI keeps showing the trial rather than suddenly charging the listed amount.
 */
export async function fetchPlatformFeeTrialState(): Promise<PlatformFeeTrialState> {
  if (!trialStateRequest) {
    trialStateRequest = fetch('/api/public/platform-fees', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to load platform fee settings');
        }
        const body = (await response.json()) as Partial<PlatformFeeTrialState>;
        return {
          trialActive:
            typeof body.trialActive === 'boolean'
              ? body.trialActive
              : PLATFORM_FEES_TRIAL_ACTIVE,
          trialEndsAt: body.trialEndsAt ?? null,
        };
      })
      .catch(() => {
        trialStateRequest = null;
        return {
          trialActive: PLATFORM_FEES_TRIAL_ACTIVE,
          trialEndsAt: null,
        };
      });
  }
  return trialStateRequest;
}

/** `12 Mar 2027` in the active locale, from a `YYYY-MM-DD` value. */
export function formatTrialEndDate(
  dateOnly: string,
  locale: string,
): string {
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateOnly;
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(parsed);
  } catch {
    return dateOnly;
  }
}

export type PlatformFeeAudience = 'client' | 'contractor';
export type PlatformFeeNoticeStep = 'sign';

export interface PlatformFeeQuote {
  contractAmount: number | null;
  currency: string;
  accessFeeUsd: number;
  accessFeeInCurrency: number | null;
  /** Due now listed = min($20 access fee, 2% success fee) when both known. */
  dueNowListed: number;
  dueNowPayable: number;
  successFeeGross: number | null;
  accessFeeCredit: number | null;
  successFeeRemaining: number | null;
  dueLaterListed: number | null;
  dueLaterPayable: number;
  trialActive: boolean;
  /** Admin-configured trial end day (`YYYY-MM-DD`), or null when unset. */
  trialEndsAt: string | null;
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
  /** Resolved trial state; omit to fall back to the constants. */
  trial?: PlatformFeeTrialState | null;
}): PlatformFeeQuote {
  const currency = (input.currency?.trim() || 'THB').toUpperCase();
  const contractAmount = parseAmount(input.contractAmount);
  const accessInCurrency = accessFeeInCurrency(currency);
  const trialActive = input.trial?.trialActive ?? PLATFORM_FEES_TRIAL_ACTIVE;

  const successFeeGross =
    contractAmount != null
      ? Math.round(contractAmount * PLATFORM_SUCCESS_FEE_RATE * 100) / 100
      : null;

  const listedCap = accessInCurrency ?? PLATFORM_ACCESS_FEE_USD;
  const dueNowListed =
    successFeeGross != null
      ? Math.min(listedCap, successFeeGross)
      : listedCap;

  const accessFeeCredit = dueNowListed;

  const successFeeRemaining =
    successFeeGross != null
      ? Math.max(0, Math.round((successFeeGross - accessFeeCredit) * 100) / 100)
      : null;

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
    dueNowPayable: trialActive ? 0 : dueNowListed,
    dueLaterListed,
    dueLaterPayable: trialActive || dueLaterListed == null ? 0 : dueLaterListed,
    trialActive,
    trialEndsAt: input.trial?.trialEndsAt ?? null,
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
