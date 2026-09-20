import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/seo-jsonld';
import { breadcrumbTrail, marketingPagesFor } from '@/lib/seo';
import { resolveServerLocale } from '@/lib/server-locale';
import { getClientAgreement } from '@/lib/legal';
import { ClientAgreementPageClient } from './client-agreement-client';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  return marketingPagesFor(locale).clientAgreement;
}

export default async function ClientAgreementPage() {
  const locale = await resolveServerLocale();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          breadcrumbTrail(locale, {
            name: getClientAgreement(locale).title,
            path: '/client-agreement',
          }),
        )}
      />
      <ClientAgreementPageClient />
    </>
  );
}
