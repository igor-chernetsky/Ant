'use client';

import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/i18n';
import { useTranslation } from '@/components/LocaleProvider';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <label className="language-switcher">
      <span className="sr-only">{t('header.language')}</span>
      <select
        className="language-switcher-select"
        value={locale}
        aria-label={t('header.language')}
        onChange={(event) => {
          const next = event.target.value;
          if (next !== locale) {
            void setLocale(next as Locale);
          }
        }}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
