import type { Metadata } from 'next';
import { LocaleProvider } from '@/components/LocaleProvider';
import { SessionProvider } from '@/components/SessionProvider';
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
          <LocaleProvider>{children}</LocaleProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
