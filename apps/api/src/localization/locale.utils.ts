import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from '../users/locale.types';

export const LOCALE_HEADER = 'x-ant-locale';

export const LOCALE_LANGUAGE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  th: 'Thai',
  ru: 'Russian',
};

export function localeLanguageName(locale: SupportedLocale): string {
  return LOCALE_LANGUAGE_NAMES[locale];
}

export function resolveRequestLocale(input: {
  headerLocale?: string | null;
  userLocale?: string | null;
}): SupportedLocale {
  const fromUser = input.userLocale?.trim();
  if (fromUser && isSupportedLocale(fromUser)) {
    return fromUser;
  }
  const fromHeader = input.headerLocale?.trim();
  if (fromHeader && isSupportedLocale(fromHeader)) {
    return fromHeader;
  }
  return DEFAULT_LOCALE;
}

export function normalizeSourceLocale(value: string | null | undefined): SupportedLocale {
  if (value && isSupportedLocale(value)) {
    return value;
  }
  return DEFAULT_LOCALE;
}
