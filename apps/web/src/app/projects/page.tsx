'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/components/LocaleProvider';

export default function ProjectsRedirectPage() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <main className="content-container main-content">
      <p className="muted">{t('home.redirecting')}</p>
    </main>
  );
}
