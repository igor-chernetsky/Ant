import { marketingPages } from '@/lib/seo';
import { ContractorAgreementPageClient } from './contractor-agreement-client';

export const metadata = marketingPages.contractorAgreement;

export default function ContractorAgreementPage() {
  return <ContractorAgreementPageClient />;
}
