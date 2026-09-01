import { marketingPages } from '@/lib/seo';
import { PrivacyPageClient } from './privacy-client';

export const metadata = marketingPages.privacy;

export default function PrivacyPage() {
  return <PrivacyPageClient />;
}
