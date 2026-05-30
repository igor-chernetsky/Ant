import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ant — Construction Marketplace',
  description: 'Browse and manage construction projects',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
