import { marketingPages } from '@/lib/seo';
import { MaterialsPageClient } from './materials-client';

export const metadata = marketingPages.materials;

export default function MaterialsMarketplacesPage() {
  return <MaterialsPageClient />;
}
