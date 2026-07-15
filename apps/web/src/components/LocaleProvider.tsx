'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSession } from '@/components/SessionProvider';
import {
  DEFAULT_LOCALE,
  isLocale,
  readLocaleCookie,
  resolveInitialLocale,
  translate,
  writeLocaleCookie,
  type Locale,
} from '@/lib/i18n';
import { updatePreferredLocale } from '@/lib/locale-preferences';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { me, ready, setMe } = useSession();
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (me?.preferredLocale && isLocale(me.preferredLocale)) {
      setLocaleState(me.preferredLocale);
      writeLocaleCookie(me.preferredLocale);
      return;
    }

    const cookieLocale = readLocaleCookie();
    if (!cookieLocale) {
      return;
    }

    setLocaleState(cookieLocale);

    if (!me) {
      return;
    }

    void updatePreferredLocale(cookieLocale)
      .then((result) => {
        setMe({ ...me, preferredLocale: result.preferredLocale });
      })
      .catch(() => {
        // keep cookie/UI locale even if profile sync fails
      });
  }, [ready, me?.preferredLocale, me?.id]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    async (next: Locale) => {
      setLocaleState(next);
      writeLocaleCookie(next);

      if (me) {
        try {
          const result = await updatePreferredLocale(next);
          setMe({ ...me, preferredLocale: result.preferredLocale });
        } catch {
          setLocaleState(
            me.preferredLocale && isLocale(me.preferredLocale)
              ? me.preferredLocale
              : DEFAULT_LOCALE,
          );
        }
      }
    },
    [me, setMe],
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}

export function useTranslation() {
  const { t, locale, setLocale } = useLocale();
  return { t, locale, setLocale };
}
