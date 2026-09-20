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
  return marketingPagesFor(locale).forContractors;
}

export default async function ForContractorsPage() {
  const locale = await resolveServerLocale();

  return (
    <>
      <JsonLd
        data={[
          faqPageJsonLd(explainerFaqItems('contractors', locale)),
          breadcrumbJsonLd(
            breadcrumbTrail(locale, {
              name: translate(locale, 'seo.breadcrumbForContractors'),
              path: '/for-contractors',
            }),
          ),
        ]}
      />
      <ExplainerLandingPage audience="contractors" />
    </>
  );
}
