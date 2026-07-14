'use client';

import { useLocale } from '@/components/LocaleProvider';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';
import { getTermsOfService } from '@/lib/legal';

export default function TermsPage() {
  const { locale } = useLocale();
  return (
    <LegalDocumentPage
      document={getTermsOfService(locale)}
      breadcrumbKey="termsOfService"
    />
  );
}
