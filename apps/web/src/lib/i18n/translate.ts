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

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const localized = lookup(locale, key);
  if (localized) {
    return interpolate(localized, params);
  }

  const fallback = lookup(DEFAULT_LOCALE, key);
  if (fallback) {
    return interpolate(fallback, params);
  }

  return key;
}
