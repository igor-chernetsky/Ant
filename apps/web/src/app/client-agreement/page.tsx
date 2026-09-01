import { marketingPages } from '@/lib/seo';
import { ClientAgreementPageClient } from './client-agreement-client';

export const metadata = marketingPages.clientAgreement;

export default function ClientAgreementPage() {
  return <ClientAgreementPageClient />;
}
