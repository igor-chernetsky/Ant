export const SUPPORTED_LOCALES = ['en', 'th', 'ru'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_COOKIE = 'ant_locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  th: 'ไทย',
  ru: 'Русский',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  th: '🇹🇭',
  ru: '🇷🇺',
};

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
