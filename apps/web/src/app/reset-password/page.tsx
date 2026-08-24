'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';

function EyeIcon({ crossed }: { crossed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden
      focusable="false"
    >
      {crossed ? (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            d="M3 3l18 18"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.6 10.6a2 2 0 0 0 2.8 2.8M6.7 6.8C4.7 8.1 3.2 9.9 2.5 12c1.5 4.2 5.3 7 9.5 7 1.7 0 3.3-.4 4.7-1.2M9.9 5.2A10.4 10.4 0 0 1 12 5c4.2 0 8 2.8 9.5 7-.4 1.1-1 2.1-1.8 3"
          />
        </>
      ) : (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.5 12C4 7.8 7.8 5 12 5s8 2.8 9.5 7c-1.5 4.2-5.3 7-9.5 7s-8-2.8-9.5-7Z"
          />
          <circle
            cx="12"
            cy="12"
            r="2.75"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          />
        </>
      )}
    </svg>
  );
}

function ResetPasswordContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get('token')?.trim() ?? '',
    [searchParams],
  );

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError(t('resetPassword.errorMissing'));
      return;
    }
    if (password.length < 8) {
      setError(t('resetPassword.errorTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('resetPassword.errorMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? t('resetPassword.errorFailed'));
      }
      setSuccess(true);
      setPassword('');
      setConfirm('');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('resetPassword.errorFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="content-container main-content verify-email-page">
      <section className="card verify-email-card">
        {success ? (
          <>
            <div className="verify-email-icon verify-email-icon--success" aria-hidden>
              ✓
            </div>
            <h1 className="verify-email-title">{t('resetPassword.successTitle')}</h1>
            <p className="verify-email-lead muted">
              {t('resetPassword.successLead')}
            </p>
            <div className="verify-email-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setLoginOpen(true)}
              >
                {t('header.signIn')}
              </button>
              <Link href="/" className="secondary">
                {t('common.backToHome')}
              </Link>
            </div>
          </>
        ) : !token ? (
          <>
            <div className="verify-email-icon verify-email-icon--error" aria-hidden>
              !
            </div>
            <h1 className="verify-email-title">{t('resetPassword.failedTitle')}</h1>
            <p className="verify-email-lead muted">
              {t('resetPassword.errorMissing')}
            </p>
            <div className="verify-email-actions">
              <Link href="/" className="primary">
                {t('common.backToHome')}
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="verify-email-title">{t('resetPassword.title')}</h1>
            <p className="verify-email-lead muted">{t('resetPassword.lead')}</p>
            <form className="modal-form reset-password-form" onSubmit={(e) => void handleSubmit(e)}>
              <label>
                {t('resetPassword.newPassword')}
                <div className="password-field">
                  <input
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="password-visibility-toggle"
                    onClick={() => setPasswordVisible((v) => !v)}
                    aria-label={
                      passwordVisible
                        ? t('auth.hidePassword')
                        : t('auth.showPassword')
                    }
                    aria-pressed={passwordVisible}
                    disabled={submitting}
                  >
                    <EyeIcon crossed={passwordVisible} />
                  </button>
                </div>
              </label>
              <label>
                {t('resetPassword.confirmPassword')}
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                  disabled={submitting}
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              <button
                type="submit"
                className="primary auth-submit"
                disabled={submitting}
              >
                {submitting
                  ? t('resetPassword.saving')
                  : t('resetPassword.submit')}
              </button>
            </form>
          </>
        )}
      </section>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false);
          window.location.href = '/';
        }}
      />
    </main>
  );
}

function ResetPasswordFallback() {
  const { t } = useTranslation();
  return (
    <main className="content-container main-content verify-email-page">
      <section className="card verify-email-card">
        <p className="muted">{t('common.loading')}</p>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <PageShell>
      <Suspense fallback={<ResetPasswordFallback />}>
        <ResetPasswordContent />
      </Suspense>
    </PageShell>
  );
}
