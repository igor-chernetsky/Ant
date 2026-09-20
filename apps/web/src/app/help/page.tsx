import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/seo-jsonld';
import { breadcrumbTrail, marketingPagesFor } from '@/lib/seo';
import { resolveServerLocale } from '@/lib/server-locale';
import { translate } from '@/lib/i18n';
import { HelpPageClient } from './help-client';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  return marketingPagesFor(locale).help;
}

export default async function HelpPage() {
  const locale = await resolveServerLocale();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          breadcrumbTrail(locale, {
            name: translate(locale, 'header.help'),
            path: '/help',
          }),
        )}
      />
      <HelpPageClient />
    </>
  );
}
