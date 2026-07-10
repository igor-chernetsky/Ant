import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/lib/i18n';

export const LOCALE_REQUEST_HEADER = 'X-Ant-Locale';

export function getClientLocaleHeaders(): Record<string, string> {
  if (typeof document === 'undefined') {
    return { [LOCALE_REQUEST_HEADER]: DEFAULT_LOCALE };
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  const value = match?.[1] ? decodeURIComponent(match[1]) : null;
  const locale = value && isLocale(value) ? value : DEFAULT_LOCALE;
  return { [LOCALE_REQUEST_HEADER]: locale };
}

export function readLocaleFromCookieHeader(
  cookieHeader: string | null | undefined,
): string {
  if (!cookieHeader) {
    return DEFAULT_LOCALE;
  }

  const match = cookieHeader.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  const value = match?.[1] ? decodeURIComponent(match[1]) : null;
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}
