/**
 * Platform fee constants (contractor-paid success fee).
 * Keep in sync with apps/web/src/lib/platform-fees.ts and legal docs.
 */
export const PLATFORM_SUCCESS_FEE_RATE = 0.02;

/** Default admin inbox from legal branding (LEGAL_CONTACT_EMAIL). Used when DB list is empty; override with PLATFORM_ADMIN_EMAIL. */
export const DEFAULT_PLATFORM_ADMIN_EMAIL = 'providercmp@gmail.com';

export function platformSuccessFeeAmount(contractAmount: number): number {
  return Math.round(contractAmount * PLATFORM_SUCCESS_FEE_RATE * 100) / 100;
}
