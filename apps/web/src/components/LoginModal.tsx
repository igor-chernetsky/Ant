'use client';

import { FormEvent, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { loginWithPassword, signupWithPassword } from '@/lib/session';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

const ROLE_KEYS = {
  client: 'auth.roleClient',
  contractor: 'auth.roleContractor',
  designer: 'auth.roleDesigner',
} as const;

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roles, setRoles] = useState<string[]>(['client']);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null);
    setSuccessNotice(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setSubmitting(true);

    try {
      if (mode === 'signin') {
        await loginWithPassword(username, password);
        setEmail('');
        setUsername('');
        setPassword('');
        setDisplayName('');
        setRoles(['client']);
        await onSuccess();
        onClose();
      } else {
        const result = await signupWithPassword({
          email,
          password,
          displayName: displayName.trim() || undefined,
          roles,
        });
        setPassword('');
        setDisplayName('');
        setRoles(['client']);
        setUsername(email);
        setEmail('');
        setMode('signin');
        if (result.verifyEmail) {
          setSuccessNotice(
            result.message ?? t('auth.verifyEmailDefault'),
          );
        } else {
          await onSuccess();
          onClose();
        }
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'signin'
            ? t('auth.signInFailed')
            : t('auth.signUpFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <div className="modal-header">
          <h2 id="login-modal-title">
            {mode === 'signin' ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="muted modal-subtitle">
          {mode === 'signin'
            ? t('auth.signInSubtitle')
            : t('auth.signUpSubtitle')}
        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          {mode === 'signin' ? (
            <label>
              {t('common.email')}
              <input
                type="email"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </label>
          ) : (
            <>
              <label>
                {t('auth.fullName')}
                <input
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={t('common.optional')}
                />
              </label>
              <label>
                {t('common.email')}
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                />
              </label>
              <fieldset className="tag-fieldset">
                <legend>{t('auth.roleLegend')}</legend>
                <p className="muted tag-hint">{t('auth.roleHint')}</p>
                <div className="tag-picker">
                  {(
                    Object.entries(ROLE_KEYS) as Array<
                      [keyof typeof ROLE_KEYS, string]
                    >
                  ).map(([id, labelKey]) => {
                    const selected = roles.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`tag-chip ${selected ? 'tag-chip-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() =>
                          setRoles((prev) => {
                            if (prev.includes(id)) {
                              const next = prev.filter((r) => r !== id);
                              return next.length > 0 ? next : ['client'];
                            }
                            return [...prev, id];
                          })
                        }
                        disabled={submitting}
                      >
                        {t(labelKey)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          <label>
            {t('common.password')}
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}
          {successNotice && (
            <p className="auth-success-notice">{successNotice}</p>
          )}

          <button type="submit" className="primary auth-submit" disabled={submitting}>
            {submitting
              ? mode === 'signin'
                ? t('auth.signingIn')
                : t('auth.creatingAccount')
              : mode === 'signin'
                ? t('header.signIn')
                : t('auth.createAccountButton')}
          </button>

          <p className="auth-mode-footer muted">
            {mode === 'signin' ? (
              <>
                {t('auth.newToAnt')}{' '}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => switchMode('signup')}
                  disabled={submitting}
                >
                  {t('auth.createAnAccount')}
                </button>
              </>
            ) : (
              <>
                {t('auth.alreadyHaveAccount')}{' '}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => switchMode('signin')}
                  disabled={submitting}
                >
                  {t('header.signIn')}
                </button>
              </>
            )}
          </p>

          <button
            type="button"
            className="secondary auth-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            {t('common.cancel')}
          </button>
        </form>
      </div>
    </div>
  );
}
