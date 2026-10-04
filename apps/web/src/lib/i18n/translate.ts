import type { Locale } from './locales';
import { DEFAULT_LOCALE } from './locales';
import { messages } from './messages';

function lookup(locale: Locale, key: string): string | undefined {
  const parts = key.split('.');
  let node: unknown = messages[locale];

  for (const part of parts) {
    if (!node || typeof node !== 'object' || !(part in node)) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }

  return typeof node === 'string' ? node : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value == null ? `{${name}}` : String(value);
  });
}

/**
 * Resolves a message key.
 *
 * A key that is present but holds an empty string is a deliberate value, not a
 * missing translation: `contractTerms.specialConditionsOptions.noneValue` is `""`
 * on purpose, because "No special conditions" must write an empty contract
 * clause. Testing truthiness made that indistinguishable from a missing key and
 * rendered the key itself — which then landed in the contract terms field.
 *
 * Only a genuinely absent key falls back to the default locale, and then to the
 * key text, so real gaps in the message files stay visible.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const localized = lookup(locale, key);
  if (localized !== undefined) {
    return interpolate(localized, params);
  }

  const fallback = lookup(DEFAULT_LOCALE, key);
  if (fallback !== undefined) {
    return interpolate(fallback, params);
  }

  return key;
}
