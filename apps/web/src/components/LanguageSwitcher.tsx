'use client';

import {
  LOCALE_FLAGS,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/i18n';
import { useTranslation } from '@/components/LocaleProvider';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      className="language-switcher"
      role="group"
      aria-label={t('header.language')}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            className={`language-switcher-flag${active ? ' language-switcher-flag--active' : ''}`}
            aria-label={t(`header.lang_${code}`)}
            aria-pressed={active}
            title={t(`header.lang_${code}`)}
            onClick={() => {
              if (code !== locale) {
                void setLocale(code);
              }
            }}
          >
            <span className="language-switcher-emoji" aria-hidden>
              {LOCALE_FLAGS[code]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
