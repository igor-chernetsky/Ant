import type { Metadata } from 'next';
import {
  getClientAgreement,
  getContractorAgreement,
  getPrivacyPolicy,
  getTermsOfService,
} from '@/lib/legal';

export const SITE_NAME = 'BuilTHAI';

export const DEFAULT_TITLE = 'BuilTHAI — Construction Marketplace';
export const DEFAULT_DESCRIPTION =
  'AI-powered construction platform: browse projects, compare bids, and manage contracts in Thailand.';

export const OPEN_GRAPH_LOCALE = 'en_US';
export const OPEN_GRAPH_ALTERNATE_LOCALES = ['ru_RU', 'th_TH'] as const;

const MAX_DESCRIPTION_LEN = 160;

export function truncateDescription(text: string, max = MAX_DESCRIPTION_LEN): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
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

export function marketingPageMetadata(options: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const { title, description, path } = options;
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
      locale: OPEN_GRAPH_LOCALE,
      alternateLocale: [...OPEN_GRAPH_ALTERNATE_LOCALES],
    },
    twitter: {
      title,
      description,
    },
  };
}

export const marketingPages = {
  forClients: marketingPageMetadata({
    title: 'For Clients',
    description:
      'Turn your project description, plans and documents into a clearer scope, a ballpark estimate and a structured contractor tender.',
    path: '/for-clients',
  }),
  forContractors: marketingPageMetadata({
    title: 'For Contractors',
    description:
      'Discover construction and renovation projects, understand the scope, ask the right questions and submit structured proposals.',
    path: '/for-contractors',
  }),
  help: marketingPageMetadata({
    title: 'Help',
    description:
      'Short guides for clients, contractors, and designers. Open a scenario when you need a quick path through the platform.',
    path: '/help',
  }),
  materials: marketingPageMetadata({
    title: 'Materials Marketplaces',
    description:
      'Browse trusted Thai retailers and platforms for construction materials. Filter by category, then open a store in a new tab.',
    path: '/materials',
  }),
  privacy: marketingPageMetadata({
    title: getPrivacyPolicy('en').title,
    description: truncateDescription(getPrivacyPolicy('en').intro),
    path: '/privacy',
  }),
  terms: marketingPageMetadata({
    title: getTermsOfService('en').title,
    description: truncateDescription(getTermsOfService('en').intro),
    path: '/terms',
  }),
  clientAgreement: marketingPageMetadata({
    title: getClientAgreement('en').title,
    description: truncateDescription(getClientAgreement('en').intro),
    path: '/client-agreement',
  }),
  contractorAgreement: marketingPageMetadata({
    title: getContractorAgreement('en').title,
    description: truncateDescription(getContractorAgreement('en').intro),
    path: '/contractor-agreement',
  }),
} as const satisfies Record<string, Metadata>;

export function projectPageMetadata(options: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const { title, description, path } = options;
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
      locale: OPEN_GRAPH_LOCALE,
      alternateLocale: [...OPEN_GRAPH_ALTERNATE_LOCALES],
    },
    twitter: {
      title,
      description,
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
