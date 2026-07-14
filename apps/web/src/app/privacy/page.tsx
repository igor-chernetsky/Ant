'use client';

import { useLocale } from '@/components/LocaleProvider';
import { LegalDocumentPage } from '@/components/LegalDocumentPage';
import { getPrivacyPolicy } from '@/lib/legal';

export default function PrivacyPage() {
  const { locale } = useLocale();
  return (
    <LegalDocumentPage
      document={getPrivacyPolicy(locale)}
      breadcrumbKey="privacyPolicy"
    />
  );
}
