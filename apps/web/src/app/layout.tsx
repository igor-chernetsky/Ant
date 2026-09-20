import type { Metadata, Viewport } from 'next';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { InAppNotificationsProvider } from '@/components/InAppNotificationsProvider';
import { JsonLd } from '@/components/JsonLd';
import { LocaleProvider } from '@/components/LocaleProvider';
import { NotificationToasts } from '@/components/NotificationToasts';
import { SessionProvider } from '@/components/SessionProvider';
import './globals.css';
import { resolveAppBaseUrl } from '@/lib/app-base-url';
import { resolveServerLocale } from '@/lib/server-locale';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo-jsonld';
import {
  OPEN_GRAPH_ALTERNATE_LOCALES,
  OPEN_GRAPH_LOCALE,
  SITE_NAME,
  ogAssetOrigin,
  siteDefaultMetadata,
  siteVerificationMetadata,
} from '@/lib/seo';

/** Canonical site URL (custom domain). */
const siteUrl = resolveAppBaseUrl();

/** Origin used for og/twitter images — see {@link ogAssetOrigin}. */
const ogImageUrl = `${ogAssetOrigin()}/og.png`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const { title, description } = siteDefaultMetadata(locale);
  const verification = siteVerificationMetadata();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${SITE_NAME}`,
    },
    description,
    ...(verification ? { verification } : {}),
    icons: {
      icon: '/logosm.png',
      apple: '/logosm.png',
    },
    openGraph: {
      type: 'website',
      locale: OPEN_GRAPH_LOCALE,
      alternateLocale: [...OPEN_GRAPH_ALTERNATE_LOCALES],
      url: siteUrl,
      siteName: 'BuilTHAI',
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: 'BuilTHAI — AI-powered construction platform',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await resolveServerLocale();

  return (
    <html lang={lang}>
      <body>
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <SessionProvider>
          <LocaleProvider>
            <InAppNotificationsProvider>
              {children}
              <NotificationToasts />
            </InAppNotificationsProvider>
          </LocaleProvider>
        </SessionProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
