import type { Metadata } from 'next';
import { InAppNotificationsProvider } from '@/components/InAppNotificationsProvider';
import { LocaleProvider } from '@/components/LocaleProvider';
import { NotificationToasts } from '@/components/NotificationToasts';
import { SessionProvider } from '@/components/SessionProvider';
import './globals.css';

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
  'https://buildthai.com';

const title = 'BuilTHAI — Construction Marketplace';
const description =
  'AI-powered construction platform: browse projects, compare bids, and manage contracts in Thailand.';

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
        url: '/og.png',
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
    images: ['/og.png'],
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
      </body>
    </html>
  );
}
