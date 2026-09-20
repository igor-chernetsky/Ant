import type { Metadata } from 'next';
import { ExplainerLandingPage } from '@/components/explainer/ExplainerLandingPage';
import { JsonLd } from '@/components/JsonLd';
import {
  breadcrumbJsonLd,
  explainerFaqItems,
  faqPageJsonLd,
} from '@/lib/seo-jsonld';
import { breadcrumbTrail, marketingPagesFor } from '@/lib/seo';
import { resolveServerLocale } from '@/lib/server-locale';
import { translate } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  return marketingPagesFor(locale).forClients;
}

export default async function ForClientsPage() {
  const locale = await resolveServerLocale();

  return (
    <>
      <JsonLd
        data={[
          faqPageJsonLd(explainerFaqItems('clients', locale)),
          breadcrumbJsonLd(
            breadcrumbTrail(locale, {
              name: translate(locale, 'seo.breadcrumbForClients'),
              path: '/for-clients',
            }),
          ),
        ]}
      />
      <ExplainerLandingPage audience="clients" />
    </>
  );
}
