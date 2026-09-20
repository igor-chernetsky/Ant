import type { Metadata } from 'next';
import { resolveAppBaseUrl } from '@/lib/app-base-url';
import {
  getClientAgreement,
  getContractorAgreement,
  getPrivacyPolicy,
  getTermsOfService,
} from '@/lib/legal';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  translate,
  type Locale,
} from '@/lib/i18n';

export const SITE_NAME = 'BuilTHAI';

export const OPEN_GRAPH_LOCALE = 'en_US';
export const OPEN_GRAPH_ALTERNATE_LOCALES = ['ru_RU', 'th_TH'] as const;

const OG_IMAGE_ALT = 'BuilTHAI — AI-powered construction platform';

const OG_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  ru: 'ru_RU',
  th: 'th_TH',
};

const MAX_DESCRIPTION_LEN = 160;

function trimOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/$/, '');
  return trimmed || null;
}

/**
 * Origin that actually serves `/og.png`. Prefer an explicit override, then the
 * Vercel production host (a custom domain can lag behind DNS moves), then the
 * canonical origin.
 */
export function ogAssetOrigin(): string {
  return (
    trimOrigin(process.env.NEXT_PUBLIC_OG_ASSET_ORIGIN) ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '')}`
      : null) ||
    resolveAppBaseUrl()
  );
}

export function openGraphImage(): {
  url: string;
  width: number;
  height: number;
  alt: string;
} {
  return {
    url: `${ogAssetOrigin()}/og.png`,
    width: 1200,
    height: 630,
    alt: OG_IMAGE_ALT,
  };
}

export function truncateDescription(text: string, max = MAX_DESCRIPTION_LEN): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function openGraphLocales(locale: Locale): {
  locale: string;
  alternateLocale: string[];
} {
  return {
    locale: OG_LOCALES[locale],
    alternateLocale: SUPPORTED_LOCALES.filter((item) => item !== locale).map(
      (item) => OG_LOCALES[item],
    ),
  };
}

export function noIndexMetadata(): Metadata {
  return {
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

/**
 * Site-ownership proofs for search engines.
 *
 * Google is usually verified through a DNS TXT record, which needs nothing in
 * the HTML — set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` only when you verify a
 * URL-prefix property with the HTML-tag method instead.
 */
export function siteVerificationMetadata(): Metadata['verification'] | undefined {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();
  const yandex = process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION?.trim();

  if (!google && !bing && !yandex) {
    return undefined;
  }

  return {
    ...(google ? { google } : {}),
    ...(yandex ? { yandex } : {}),
    ...(bing ? { other: { 'msvalidate.01': bing } } : {}),
  };
}

/** Localized default title/description for the root layout. */
export function siteDefaultMetadata(locale: Locale): {
  title: string;
  description: string;
} {
  return {
    title: translate(locale, 'seo.home.title'),
    description: translate(locale, 'seo.home.description'),
  };
}

/** Localized breadcrumb trail: home + the current page. */
export function breadcrumbTrail(
  locale: Locale,
  current: { name: string; path: string },
): Array<{ name: string; path: string }> {
  return [
    { name: translate(locale, 'seo.breadcrumbHome'), path: '/' },
    current,
  ];
}

export function marketingPageMetadata(options: {
  title: string;
  description: string;
  path: string;
  locale?: Locale;
}): Metadata {
  const { title, description, path, locale = DEFAULT_LOCALE } = options;
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      type: 'website',
      images: [openGraphImage()],
      ...openGraphLocales(locale),
    },
    twitter: {
      title,
      description,
      images: [`${ogAssetOrigin()}/og.png`],
    },
  };
}

function localizedSeoCopy(
  locale: Locale,
  key: 'forClients' | 'forContractors' | 'help' | 'materials',
): { title: string; description: string } {
  return {
    title: translate(locale, `seo.${key}.title`),
    description: translate(locale, `seo.${key}.description`),
  };
}

export function marketingPagesFor(locale: Locale = DEFAULT_LOCALE) {
  const privacy = getPrivacyPolicy(locale);
  const terms = getTermsOfService(locale);
  const clientAgreement = getClientAgreement(locale);
  const contractorAgreement = getContractorAgreement(locale);

  return {
    forClients: marketingPageMetadata({
      ...localizedSeoCopy(locale, 'forClients'),
      path: '/for-clients',
      locale,
    }),
    forContractors: marketingPageMetadata({
      ...localizedSeoCopy(locale, 'forContractors'),
      path: '/for-contractors',
      locale,
    }),
    help: marketingPageMetadata({
      ...localizedSeoCopy(locale, 'help'),
      path: '/help',
      locale,
    }),
    materials: marketingPageMetadata({
      ...localizedSeoCopy(locale, 'materials'),
      path: '/materials',
      locale,
    }),
    privacy: marketingPageMetadata({
      title: privacy.title,
      description: truncateDescription(privacy.intro),
      path: '/privacy',
      locale,
    }),
    terms: marketingPageMetadata({
      title: terms.title,
      description: truncateDescription(terms.intro),
      path: '/terms',
      locale,
    }),
    clientAgreement: marketingPageMetadata({
      title: clientAgreement.title,
      description: truncateDescription(clientAgreement.intro),
      path: '/client-agreement',
      locale,
    }),
    contractorAgreement: marketingPageMetadata({
      title: contractorAgreement.title,
      description: truncateDescription(contractorAgreement.intro),
      path: '/contractor-agreement',
      locale,
    }),
  } as const;
}

export function projectPageMetadata(options: {
  title: string;
  description: string;
  path: string;
  locale?: Locale;
}): Metadata {
  const { title, description, path, locale = DEFAULT_LOCALE } = options;
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      type: 'website',
      images: [openGraphImage()],
      ...openGraphLocales(locale),
    },
    twitter: {
      title,
      description,
      images: [`${ogAssetOrigin()}/og.png`],
    },
  };
}

/** Public marketing URLs included in sitemap.xml */
export const SITEMAP_PATHS = [
  '/',
  '/for-clients',
  '/for-contractors',
  '/help',
  '/materials',
  '/privacy',
  '/terms',
  '/client-agreement',
  '/contractor-agreement',
] as const;
