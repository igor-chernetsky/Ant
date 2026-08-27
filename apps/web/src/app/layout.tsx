import type { Metadata, Viewport } from 'next';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { InAppNotificationsProvider } from '@/components/InAppNotificationsProvider';
import { LocaleProvider } from '@/components/LocaleProvider';
import { NotificationToasts } from '@/components/NotificationToasts';
import { SessionProvider } from '@/components/SessionProvider';
import './globals.css';
import { resolveAppBaseUrl } from '@/lib/app-base-url';

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

const title = 'BuilTHAI — Construction Marketplace';
const description =
  'AI-powered construction platform: browse projects, compare bids, and manage contracts in Thailand.';

const ogImageUrl = `${ogAssetOrigin}/og.png`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: '/logosm.png',
    apple: '/logosm.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
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
