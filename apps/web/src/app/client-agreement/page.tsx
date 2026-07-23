'use client';

import { useLocale } from '@/components/LocaleProvider';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';
import { getClientAgreement } from '@/lib/legal';

export default function ClientAgreementPage() {
  const { locale } = useLocale();
  return (
    <LegalDocumentPage
      document={getClientAgreement(locale)}
      breadcrumbKey="clientAgreement"
    />
  );
}
