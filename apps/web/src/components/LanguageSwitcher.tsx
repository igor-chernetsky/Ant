'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/i18n';
import { localizePath, stripLocalePrefix } from '@/lib/locale-path';
import { useTranslation } from '@/components/LocaleProvider';

const LOCALE_FLAG_ASSETS: Record<Locale, string> = {
  en: '/flags/gb.svg',
  th: '/flags/th.svg',
  ru: '/flags/ru.svg',
};

function LocaleFlag({ locale, size = 20 }: { locale: Locale; size?: number }) {
  return (
    <Image
      src={LOCALE_FLAG_ASSETS[locale]}
      alt=""
      width={size}
      height={Math.round(size * 0.67)}
      className="language-switcher-flag-img"
      aria-hidden
    />
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectLocale = (next: Locale) => {
    setOpen(false);
    if (next === locale) {
      return;
    }
    /**
     * The URL carries the locale for English/Thai/Russian (`/`, `/th/…`, `/ru/…`),
     * so switching has to move to the other URL: the path prefix wins over the
     * cookie on the server render.
     */
    const basePath = stripLocalePrefix(pathname || '/');
    const target = localizePath(basePath, next);
    void setLocale(next);
    if (target !== pathname) {
      router.replace(target);
    }
  };

  return (
    <div className="language-switcher" ref={rootRef}>
      <button
        type="button"
        className="language-switcher-trigger"
        aria-label={t('header.language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        <LocaleFlag locale={locale} />
        <span className="language-switcher-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <ul
          id={listboxId}
          className="language-switcher-menu"
          role="listbox"
          aria-label={t('header.language')}
        >
          {SUPPORTED_LOCALES.map((code) => {
            const active = code === locale;
            return (
              <li key={code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`language-switcher-option${
                    active ? ' language-switcher-option--active' : ''
                  }`}
                  onClick={() => selectLocale(code)}
                >
                  <LocaleFlag locale={code} />
                  <span>{LOCALE_LABELS[code]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
