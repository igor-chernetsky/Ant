import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

export function localeFromCookieValue(
  value: string | null | undefined,
): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Locale for server-rendered metadata, copy and JSON-LD.
 *
 * The app keeps a single URL per page and switches language through the
 * `ant_locale` cookie, so a crawler that sends no cookie always gets
 * {@link DEFAULT_LOCALE}.
 */
export async function resolveServerLocale(): Promise<Locale> {
  const store = await cookies();
  return localeFromCookieValue(store.get(LOCALE_COOKIE)?.value);
}
