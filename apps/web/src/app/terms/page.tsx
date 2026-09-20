import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/seo-jsonld';
import { breadcrumbTrail, marketingPagesFor } from '@/lib/seo';
import { resolveServerLocale } from '@/lib/server-locale';
import { getTermsOfService } from '@/lib/legal';
import { TermsPageClient } from './terms-client';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  return marketingPagesFor(locale).terms;
}

export default async function TermsPage() {
  const locale = await resolveServerLocale();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          breadcrumbTrail(locale, {
            name: getTermsOfService(locale).title,
            path: '/terms',
          }),
        )}
      />
      <TermsPageClient />
    </>
  );
}
