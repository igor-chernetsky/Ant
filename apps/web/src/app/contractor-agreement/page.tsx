'use client';

import { useLocale } from '@/components/LocaleProvider';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';
import { getContractorAgreement } from '@/lib/legal';

export default function ContractorAgreementPage() {
  const { locale } = useLocale();
  return (
    <LegalDocumentPage
      document={getContractorAgreement(locale)}
      breadcrumbKey="contractorAgreement"
    />
  );
}
