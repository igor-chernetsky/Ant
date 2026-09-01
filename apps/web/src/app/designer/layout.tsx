import type { ReactNode } from 'react';
import { noIndexMetadata } from '@/lib/seo';

export const metadata = noIndexMetadata();

export default function DesignerPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
