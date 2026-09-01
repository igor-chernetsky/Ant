'use client';

import { useLocale } from '@/components/LocaleProvider';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';
import { getTermsOfService } from '@/lib/legal';

export function TermsPageClient() {
  const { locale } = useLocale();
  return (
    <LegalDocumentPage
      document={getTermsOfService(locale)}
      breadcrumbKey="termsOfService"
    />
  );
}
