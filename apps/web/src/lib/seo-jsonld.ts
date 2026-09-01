import { resolveAppBaseUrl } from '@/lib/app-base-url';
import { LEGAL_CONTACT_EMAIL, LEGAL_PLATFORM_NAME } from '@/lib/legal/branding';
import { translate } from '@/lib/i18n';

export type JsonLdObject = Record<string, unknown>;

export function jsonLdScript(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function organizationJsonLd(): JsonLdObject {
  const siteUrl = resolveAppBaseUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: LEGAL_PLATFORM_NAME,
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    email: LEGAL_CONTACT_EMAIL,
    description:
      'AI-powered construction marketplace for clients and contractors in Thailand.',
  };
}

export function websiteJsonLd(): JsonLdObject {
  const siteUrl = resolveAppBaseUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: LEGAL_PLATFORM_NAME,
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function faqPageJsonLd(
  items: Array<{ question: string; answer: string }>,
): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function explainerFaqItems(
  audience: 'clients' | 'contractors',
): Array<{ question: string; answer: string }> {
  const base = `explainer.${audience}.faq`;
  const count = audience === 'clients' ? 8 : 6;
  const items: Array<{ question: string; answer: string }> = [];

  for (let index = 1; index <= count; index += 1) {
    const question = translate('en', `${base}.item${index}Question`);
    const answer = translate('en', `${base}.item${index}Answer`);
    if (question.startsWith('explainer.') || answer.startsWith('explainer.')) {
      continue;
    }
    items.push({ question, answer });
  }

  return items;
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
): JsonLdObject {
  const siteUrl = resolveAppBaseUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
}
