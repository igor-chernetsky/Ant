import type { Metadata } from 'next';
import { InAppNotificationsProvider } from '@/components/InAppNotificationsProvider';
import { LocaleProvider } from '@/components/LocaleProvider';
import { NotificationToasts } from '@/components/NotificationToasts';
import { SessionProvider } from '@/components/SessionProvider';
import { SupplyVerificationBanner } from '@/components/SupplyVerificationBanner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ant — Construction Marketplace',
  description: 'Browse and manage construction projects',
  icons: {
    icon: '/ant-logo.png',
    apple: '/ant-logo.png',
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
              <SupplyVerificationBanner />
              {children}
              <NotificationToasts />
            </InAppNotificationsProvider>
          </LocaleProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
