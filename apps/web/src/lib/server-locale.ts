import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/lib/i18n/locales';
import type { Locale } from '@/lib/i18n/locales';
import {
  NEGOTIATED_LOCALE_HEADER,
  PATH_LOCALE_HEADER,
} from '@/lib/locale-negotiation';

export function localeFromCookieValue(
  value: string | null | undefined,
): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Locale for server-rendered metadata, copy and JSON-LD.
 *
 * Order matters, and the URL wins:
 *
 * 1. the locale encoded in the path (`/th`, `/ru`) — it is what the visitor or a
 *    crawler asked for, and `hreflang`/canonical promise exactly that language;
 * 2. the `ant_locale` cookie — an explicit choice from the language switcher, which
 *    also covers unprefixed links and the `?tag=` search URLs;
 * 3. the locale the middleware negotiated from `Accept-Language` for this very
 *    request (a first visit has no cookie yet);
 * 4. the default.
 *
 * The cookie used to come first, and that let a stale cookie flip a Thai URL back
 * to English: the switcher updated the dropdown and the cookie, the address bar
 * still said `/th`, and the server rendered the old language.
 */
export async function resolveServerLocale(): Promise<Locale> {
  const headerStore = await headers();

  const fromPath = headerStore.get(PATH_LOCALE_HEADER);
  if (fromPath && isLocale(fromPath)) {
    return fromPath;
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (fromCookie && isLocale(fromCookie)) {
    return fromCookie;
  }

  const negotiated = headerStore.get(NEGOTIATED_LOCALE_HEADER);
  if (negotiated && isLocale(negotiated)) {
    return negotiated;
  }

  return DEFAULT_LOCALE;
}
