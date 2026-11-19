import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/i18n/locales';

/**
 * Locale in the URL, for search engines.
 *
 * The interface language still lives in the `ant_locale` cookie, but cookie-only
 * language means a crawler sees English and nothing else — Thai and Russian pages
 * never enter the index. Non-default locales therefore also get a real URL prefix:
 *
 *   English (default)  https://www.builthai.com/for-clients
 *   Thai               https://www.builthai.com/th/for-clients
 *   Russian            https://www.builthai.com/ru/for-clients
 *
 * The middleware rewrites those prefixes onto the same route tree, so the app
 * keeps a single set of pages, and `hreflang` alternates point at all three.
 */

const LOCALE_SEGMENTS = SUPPORTED_LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE,
);

/** `/th` for Thai, `/ru` for Russian, `''` for the default locale. */
export function localePrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

/**
 * Site path for a locale: `localizePath('/for-clients', 'th')` → `/th/for-clients`,
 * and the root stays `/th` rather than `/th/`.
 */
export function localizePath(path: string, locale: Locale): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const prefix = localePrefix(locale);
  if (!prefix) {
    return normalized;
  }
  return normalized === '/' ? prefix : `${prefix}${normalized}`;
}

/** Locale encoded in a pathname, or `null` when the path carries no prefix. */
export function localeFromPathname(pathname: string): Locale | null {
  const segment = pathname.split('/')[1] ?? '';
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(segment)) {
    return null;
  }
  return segment === DEFAULT_LOCALE ? null : (segment as Locale);
}

/**
 * The path without its locale prefix: `/th/for-clients` → `/for-clients`,
 * `/th` → `/`. An unprefixed path is returned unchanged.
 */
export function stripLocalePrefix(pathname: string): string {
  const locale = localeFromPathname(pathname);
  if (!locale) {
    return pathname;
  }
  const rest = pathname.slice(localePrefix(locale).length);
  return rest.startsWith('/') ? rest : `/${rest}`;
}

/**
 * `hreflang` map for a path: every locale variant plus `x-default` (English).
 * Values are root-relative; Next resolves them against `metadataBase`.
 */
export function localeAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    languages[locale] = localizePath(path, locale);
  }
  languages['x-default'] = localizePath(path, DEFAULT_LOCALE);
  return languages;
}

/** Locale prefix of a pathname, for canonical tags: `/th` or `''`. */
export function pathnameLocalePrefix(pathname: string): string {
  const locale = localeFromPathname(pathname);
  return locale ? localePrefix(locale) : '';
}

export { LOCALE_SEGMENTS };
