import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { InAppNotificationsProvider } from '@/components/InAppNotificationsProvider';
import { JsonLd } from '@/components/JsonLd';
import { LocaleProvider } from '@/components/LocaleProvider';
import { NotificationToasts } from '@/components/NotificationToasts';
import { SessionProvider } from '@/components/SessionProvider';
import './globals.css';
import { resolveAppBaseUrl } from '@/lib/app-base-url';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/lib/i18n';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo-jsonld';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  OPEN_GRAPH_ALTERNATE_LOCALES,
  OPEN_GRAPH_LOCALE,
  SITE_NAME,
} from '@/lib/seo';

function trimOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/$/, '');
  return trimmed || null;
}

/** Canonical site URL (custom domain). */
const siteUrl = resolveAppBaseUrl();

/**
 * Origin used for og/twitter images. Prefer an origin that actually serves
 * `/og.png` today (Vercel deployment). Custom domain can lag or point elsewhere
 * while DNS is being moved.
 */
const ogAssetOrigin =
  trimOrigin(process.env.NEXT_PUBLIC_OG_ASSET_ORIGIN) ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '')}`
    : null) ||
  siteUrl;

const title = DEFAULT_TITLE;
const description = DEFAULT_DESCRIPTION;

const ogImageUrl = `${ogAssetOrigin}/og.png`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s | ${SITE_NAME}`,
  },
  description,
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  const lang =
    localeCookie && isLocale(localeCookie) ? localeCookie : DEFAULT_LOCALE;

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
