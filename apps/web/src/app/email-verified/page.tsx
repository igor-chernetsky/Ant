'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PageShell } from '@/components/PageShell';

function EmailVerifiedContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const verified = searchParams.get('verified') === '1';

  const isSuccess = verified && !error;

  return (
    <main className="content-container main-content verify-email-page">
      <section className="card verify-email-card">
        {isSuccess ? (
          <>
            <div className="verify-email-icon verify-email-icon--success" aria-hidden>
              ✓
            </div>
            <h1 className="verify-email-title">Email verified</h1>
            <p className="verify-email-lead muted">
              Your address is confirmed. You can sign in and start using Ant
              Construction.
            </p>
          </>
        ) : (
          <>
            <div className="verify-email-icon verify-email-icon--error" aria-hidden>
              !
            </div>
            <h1 className="verify-email-title">Verification failed</h1>
            <p className="verify-email-lead muted">
              {error === 'expired' &&
                'This verification link has expired. Sign in and request a new verification email, or create a new account.'}
              {error === 'invalid' &&
                'This verification link is invalid or has already been used.'}
              {error === 'missing' &&
                'No verification token was provided.'}
              {error === 'failed' &&
                'We could not verify your email. Please try again later.'}
              {!['expired', 'invalid', 'missing', 'failed'].includes(
                error ?? '',
              ) &&
                error &&
                'Something went wrong while verifying your email.'}
            </p>
          </>
        )}

        <div className="verify-email-actions">
          <Link href="/" className="primary">
            {isSuccess ? 'Continue to Ant' : 'Back to home'}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function EmailVerifiedPage() {
  return (
    <PageShell>
      <Suspense
        fallback={
          <main className="content-container main-content verify-email-page">
            <section className="card verify-email-card">
              <p className="muted">Loading…</p>
            </section>
          </main>
        }
      >
        <EmailVerifiedContent />
      </Suspense>
    </PageShell>
  );
}
