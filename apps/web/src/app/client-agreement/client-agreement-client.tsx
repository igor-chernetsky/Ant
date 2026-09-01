'use client';

import { useLocale } from '@/components/LocaleProvider';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';
import { getClientAgreement } from '@/lib/legal';

export function ClientAgreementPageClient() {
  const { locale } = useLocale();
  return (
    <LegalDocumentPage
      document={getClientAgreement(locale)}
      breadcrumbKey="clientAgreement"
    />
  );
}
