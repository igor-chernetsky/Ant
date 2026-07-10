import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from './locales';
import type { Locale } from './locales';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function readLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  const value = match?.[1] ? decodeURIComponent(match[1]) : null;
  return value && isLocale(value) ? value : null;
}

export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function resolveInitialLocale(): Locale {
  return readLocaleCookie() ?? DEFAULT_LOCALE;
}
