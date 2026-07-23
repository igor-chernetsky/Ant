'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/LocaleProvider';

export function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="content-container site-footer-inner">
        <p className="site-footer-copy muted">
          {t('footer.copyright', { year })}
        </p>
        <nav className="site-footer-nav" aria-label={t('footer.legalNav')}>
          <Link href="/privacy" className="text-link">
            {t('footer.privacyPolicy')}
          </Link>
          <Link href="/terms" className="text-link">
            {t('footer.termsOfService')}
          </Link>
          <Link href="/client-agreement" className="text-link">
            {t('footer.clientAgreement')}
          </Link>
          <Link href="/contractor-agreement" className="text-link">
            {t('footer.contractorAgreement')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
