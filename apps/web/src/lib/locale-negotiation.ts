import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/i18n/locales';

/**
 * Request header the middleware sets on a first visit so the server render that
 * answers that same request already uses the negotiated locale. The persisted
 * cookie only takes effect from the next request, which would otherwise cause a
 * visible switch from English.
 */
export const NEGOTIATED_LOCALE_HEADER = 'x-ant-locale-negotiated';

type WeightedTag = { tag: string; quality: number; order: number };

function parseWeightedTags(header: string): WeightedTag[] {
  const tags: WeightedTag[] = [];

  header.split(',').forEach((part, order) => {
    const [rawTag, ...params] = part.split(';');
    const tag = rawTag?.trim().toLowerCase();
    if (!tag) {
      return;
    }

    let quality = 1;
    for (const param of params) {
      const [key, value] = param.split('=');
      if (key?.trim().toLowerCase() === 'q') {
        const parsed = Number.parseFloat(value ?? '');
        quality = Number.isFinite(parsed) ? parsed : 0;
      }
    }

    tags.push({ tag, quality, order });
  });

  // Highest quality first; ties keep the order the client sent.
  return tags.sort((a, b) => b.quality - a.quality || a.order - b.order);
}

/**
 * First supported locale from the visitor's `Accept-Language`, or `null` when
 * nothing matches (the caller then keeps {@link DEFAULT_LOCALE}).
 *
 * Only used for a visit without the `ant_locale` cookie: an explicit choice in
 * the language switcher is never re-negotiated.
 */
export function negotiateLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  if (!header) {
    return null;
  }

  for (const { tag, quality } of parseWeightedTags(header)) {
    if (quality <= 0) {
      continue;
    }

    const primary = tag.split('-')[0];
    if (
      primary &&
      (SUPPORTED_LOCALES as readonly string[]).includes(primary)
    ) {
      return primary as Locale;
    }
  }

  return null;
}
