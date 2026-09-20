import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/seo-jsonld';
import { breadcrumbTrail, marketingPagesFor } from '@/lib/seo';
import { resolveServerLocale } from '@/lib/server-locale';
import { getPrivacyPolicy } from '@/lib/legal';
import { PrivacyPageClient } from './privacy-client';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  return marketingPagesFor(locale).privacy;
}

export default async function PrivacyPage() {
  const locale = await resolveServerLocale();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          breadcrumbTrail(locale, {
            name: getPrivacyPolicy(locale).title,
            path: '/privacy',
          }),
        )}
      />
      <PrivacyPageClient />
    </>
  );
}
