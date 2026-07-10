'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';

function EmailVerifiedContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const verified = searchParams.get('verified') === '1';

  const isSuccess = verified && !error;

  const errorMessage = (() => {
    if (error === 'expired') return t('emailVerified.errorExpired');
    if (error === 'invalid') return t('emailVerified.errorInvalid');
    if (error === 'missing') return t('emailVerified.errorMissing');
    if (error === 'failed') return t('emailVerified.errorFailed');
    if (error) return t('emailVerified.errorGeneric');
    return null;
  })();

  return (
    <main className="content-container main-content verify-email-page">
      <section className="card verify-email-card">
        {isSuccess ? (
          <>
            <div className="verify-email-icon verify-email-icon--success" aria-hidden>
              ✓
            </div>
            <h1 className="verify-email-title">{t('emailVerified.successTitle')}</h1>
            <p className="verify-email-lead muted">
              {t('emailVerified.successLead')}
            </p>
          </>
        ) : (
          <>
            <div className="verify-email-icon verify-email-icon--error" aria-hidden>
              !
            </div>
            <h1 className="verify-email-title">{t('emailVerified.failedTitle')}</h1>
            <p className="verify-email-lead muted">{errorMessage}</p>
          </>
        )}

        <div className="verify-email-actions">
          <Link href="/" className="primary">
            {isSuccess ? t('common.continueToAnt') : t('common.backToHome')}
          </Link>
        </div>
      </section>
    </main>
  );
}

function EmailVerifiedFallback() {
  const { t } = useTranslation();

  return (
    <main className="content-container main-content verify-email-page">
      <section className="card verify-email-card">
        <p className="muted">{t('common.loading')}</p>
      </section>
    </main>
  );
}

export default function EmailVerifiedPage() {
  return (
    <PageShell>
      <Suspense fallback={<EmailVerifiedFallback />}>
        <EmailVerifiedContent />
      </Suspense>
    </PageShell>
  );
}
