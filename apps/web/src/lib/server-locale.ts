import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/lib/i18n/locales';
import type { Locale } from '@/lib/i18n/locales';
import { NEGOTIATED_LOCALE_HEADER } from '@/lib/locale-negotiation';

export function localeFromCookieValue(
  value: string | null | undefined,
): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Locale for server-rendered metadata, copy and JSON-LD.
 *
 * The app keeps a single URL per page and switches language through the
 * `ant_locale` cookie, so a crawler that sends no cookie and no usable
 * `Accept-Language` always gets {@link DEFAULT_LOCALE}.
 *
 * Order: an explicit cookie choice, then the locale the middleware negotiated
 * for this very request (a first visit has no cookie yet), then the default.
 */
export async function resolveServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (fromCookie && isLocale(fromCookie)) {
    return fromCookie;
  }

  const headerStore = await headers();
  const negotiated = headerStore.get(NEGOTIATED_LOCALE_HEADER);
  if (negotiated && isLocale(negotiated)) {
    return negotiated;
  }

  return DEFAULT_LOCALE;
}
