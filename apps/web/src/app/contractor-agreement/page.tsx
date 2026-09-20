import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/seo-jsonld';
import { breadcrumbTrail, marketingPagesFor } from '@/lib/seo';
import { resolveServerLocale } from '@/lib/server-locale';
import { getContractorAgreement } from '@/lib/legal';
import { ContractorAgreementPageClient } from './contractor-agreement-client';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  return marketingPagesFor(locale).contractorAgreement;
}

export default async function ContractorAgreementPage() {
  const locale = await resolveServerLocale();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          breadcrumbTrail(locale, {
            name: getContractorAgreement(locale).title,
            path: '/contractor-agreement',
          }),
        )}
      />
      <ContractorAgreementPageClient />
    </>
  );
}
