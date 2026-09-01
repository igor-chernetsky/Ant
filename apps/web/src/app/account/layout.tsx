import type { ReactNode } from 'react';
import { noIndexMetadata } from '@/lib/seo';

export const metadata = noIndexMetadata();

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}
