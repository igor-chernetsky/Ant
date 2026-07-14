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
        </nav>
      </div>
    </footer>
  );
}
