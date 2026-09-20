import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/seo-jsonld';
import { breadcrumbTrail, marketingPagesFor } from '@/lib/seo';
import { resolveServerLocale } from '@/lib/server-locale';
import { translate } from '@/lib/i18n';
import { MaterialsPageClient } from './materials-client';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  return marketingPagesFor(locale).materials;
}

export default async function MaterialsMarketplacesPage() {
  const locale = await resolveServerLocale();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          breadcrumbTrail(locale, {
            name: translate(locale, 'header.materials'),
            path: '/materials',
          }),
        )}
      />
      <MaterialsPageClient />
    </>
  );
}
