import { marketingPages } from '@/lib/seo';
import { HelpPageClient } from './help-client';

export const metadata = marketingPages.help;

export default function HelpPage() {
  return <HelpPageClient />;
}
