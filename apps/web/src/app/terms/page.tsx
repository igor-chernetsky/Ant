import { marketingPages } from '@/lib/seo';
import { TermsPageClient } from './terms-client';

export const metadata = marketingPages.terms;

export default function TermsPage() {
  return <TermsPageClient />;
}
