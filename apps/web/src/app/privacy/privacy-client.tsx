'use client';

import { useLocale } from '@/components/LocaleProvider';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';
import { getPrivacyPolicy } from '@/lib/legal';

export function PrivacyPageClient() {
  const { locale } = useLocale();
  return (
    <LegalDocumentPage
      document={getPrivacyPolicy(locale)}
      breadcrumbKey="privacyPolicy"
    />
  );
}
