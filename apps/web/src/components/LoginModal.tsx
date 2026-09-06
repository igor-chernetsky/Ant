'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useTranslation } from '@/components/LocaleProvider';
import {
  loginWithPassword,
  requestPasswordReset,
  signupWithPassword,
} from '@/lib/session';
import { AnalyticsEvents, trackEvent } from '@/lib/analytics';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

const ROLE_KEYS = {
  client: 'auth.roleClient',
  contractor: 'auth.roleContractor',
  designer: 'auth.roleDesigner',
} as const;

const ROLE_DESC_KEYS = {
  client: 'auth.roleClientDesc',
  contractor: 'auth.roleContractorDesc',
  designer: 'auth.roleDesignerDesc',
} as const;

const ROLE_ORDER: Array<keyof typeof ROLE_KEYS> = [
  'client',
  'contractor',
  'designer',
];

type AuthField = 'username' | 'email' | 'password' | 'displayName';
type FieldErrors = Partial<Record<AuthField, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapServerErrorToFields(message: string): AuthField[] {
  const m = message.toLowerCase();
  if (
    m.includes('invalid username or password') ||
    m.includes('invalid credentials')
  ) {
    return ['username', 'password'];
  }
  if (m.includes('already exists')) return ['email'];
  if (m.includes('password must be at least')) return ['password'];
  if (m.includes('email and password are required')) {
    return ['email', 'password'];
  }
  return [];
}

function RoleGlyph({ role }: { role: keyof typeof ROLE_KEYS }) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (role === 'client') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
        <path {...stroke} d="M3 11.2 12 4l9 7.2" />
        <path {...stroke} d="M5.5 9.8V20h13V9.8" />
        <path {...stroke} d="M10 20v-5.5h4V20" />
      </svg>
    );
  }
  if (role === 'contractor') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
        <path {...stroke} d="M5 14.5a7 7 0 0 1 14 0" />
        <path
          {...stroke}
          d="M12 8a5.3 5.3 0 0 0-5.3 5.3V16h10.6v-2.7A5.3 5.3 0 0 0 12 8Z"
        />
        <path {...stroke} d="M3.5 16h17" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
      <path
        {...stroke}
        d="M4 20l1.2-4.8L16.4 4l3.6 3.6L9.6 18.2 4 20Z"
      />
      <path {...stroke} d="M14.5 6.5l3 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12.5l4.5 4.5L19 7"
      />
    </svg>
  );
}

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

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [roles, setRoles] = useState<string[]>(['client']);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedClientAgreement, setAcceptedClientAgreement] = useState(false);
  const [acceptedContractorAgreement, setAcceptedContractorAgreement] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const fieldRefs: Record<AuthField, React.RefObject<HTMLInputElement | null>> = {
    username: usernameRef,
    email: emailRef,
    password: passwordRef,
    displayName: displayNameRef,
  };

  const focusField = (field: AuthField) => {
    const ref = fieldRefs[field];
    requestAnimationFrame(() => {
      ref.current?.focus({ preventScroll: true });
      ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const clearFieldError = (field: AuthField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Keep the top-level (non-field) error above the on-screen keyboard.
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [error]);

  if (!isOpen) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setSuccessNotice(null);
    setFieldErrors({});
    setPasswordVisible(false);
    setAcceptedPrivacy(false);
    setAcceptedClientAgreement(false);
    setAcceptedContractorAgreement(false);
    if (next === 'forgot' && !email && username) {
      setEmail(username);
    }
  };

  const validateFields = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (mode === 'signin') {
      if (!username.trim()) errors.username = t('auth.requiredField');
      else if (!EMAIL_RE.test(username.trim())) {
        errors.username = t('auth.invalidEmail');
      }
      if (!password) errors.password = t('auth.requiredField');
    } else if (mode === 'forgot') {
      if (!email.trim()) errors.email = t('auth.requiredField');
      else if (!EMAIL_RE.test(email.trim())) {
        errors.email = t('auth.invalidEmail');
      }
    } else {
      if (!email.trim()) errors.email = t('auth.requiredField');
      else if (!EMAIL_RE.test(email.trim())) {
        errors.email = t('auth.invalidEmail');
      }
      if (!password) errors.password = t('auth.requiredField');
      else if (password.length < 8) errors.password = t('auth.passwordMin');
    }
    return errors;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setFieldErrors({});

    const needsClientAgreement = roles.includes('client');
    const needsContractorAgreement =
      roles.includes('contractor') || roles.includes('designer');
    if (
      mode === 'signup' &&
      (!acceptedPrivacy ||
        (needsClientAgreement && !acceptedClientAgreement) ||
        (needsContractorAgreement && !acceptedContractorAgreement))
    ) {
      setError(t('auth.acceptLegalRequired'));
      return;
    }

    // Highlight + focus the first invalid field so the error stays visible even
    // when the on-screen keyboard covers the bottom of the form.
    const fieldValidation = validateFields();
    if (Object.keys(fieldValidation).length > 0) {
      setFieldErrors(fieldValidation);
      const first = (
        ['username', 'email', 'displayName', 'password'] as AuthField[]
      ).find((field) => fieldValidation[field]);
      if (first) focusField(first);
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'signin') {
        await loginWithPassword(username, password);
        trackEvent(AnalyticsEvents.login, { method: 'password' });
        setEmail('');
        setUsername('');
        setPassword('');
        setDisplayName('');
        setRoles(['client']);
        setAcceptedPrivacy(false);
        setAcceptedClientAgreement(false);
        setAcceptedContractorAgreement(false);
        await onSuccess();
        onClose();
      } else if (mode === 'forgot') {
        const message = await requestPasswordReset(email.trim());
        setSuccessNotice(message || t('auth.forgotPasswordSent'));
        setPassword('');
      } else {
        const result = await signupWithPassword({
          email,
          password,
          displayName: displayName.trim() || undefined,
          roles,
        });
        trackEvent(AnalyticsEvents.signUp, {
          method: 'password',
          roles: roles.slice().sort().join(','),
          verify_email_required: Boolean(result.verifyEmail),
        });
        setPassword('');
        setDisplayName('');
        setRoles(['client']);
        setAcceptedPrivacy(false);
        setAcceptedClientAgreement(false);
        setAcceptedContractorAgreement(false);
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
      const message =
        err instanceof Error
          ? err.message
          : mode === 'signin'
            ? t('auth.signInFailed')
            : mode === 'forgot'
              ? t('auth.forgotPasswordFailed')
              : t('auth.signUpFailed');

      const fields = mapServerErrorToFields(message);
      if (fields.length > 0) {
        const mapped: FieldErrors = {};
        for (const field of fields) {
          mapped[field] = message;
        }
        setFieldErrors(mapped);
        focusField(fields[0]);
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const needsClientAgreement = roles.includes('client');
  const needsContractorAgreement =
    roles.includes('contractor') || roles.includes('designer');
  const canSubmitSignup =
    acceptedPrivacy &&
    (!needsClientAgreement || acceptedClientAgreement) &&
    (!needsContractorAgreement || acceptedContractorAgreement);

  const title =
    mode === 'signin'
      ? t('auth.welcomeBack')
      : mode === 'forgot'
        ? t('auth.forgotPasswordTitle')
        : t('auth.createAccount');

  const subtitle =
    mode === 'signin'
      ? t('auth.signInSubtitle')
      : mode === 'forgot'
        ? t('auth.forgotPasswordSubtitle')
        : t('auth.signUpSubtitle');

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        const active = document.activeElement;
        const isFormField =
          active instanceof HTMLElement &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.isContentEditable);
        if (isFormField) {
          // Keyboard is likely open — dismiss it without losing the form.
          active.blur();
          return;
        }
        onClose();
      }}
    >
      <div
        className="modal auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <div className="modal-header">
          <h2 id="login-modal-title">{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="muted modal-subtitle">{subtitle}</p>

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          {mode === 'signin' ? (
            <label>
              {t('common.email')}
              <input
                ref={usernameRef}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  clearFieldError('username');
                }}
                placeholder={t('auth.emailPlaceholder')}
                aria-invalid={fieldErrors.username ? true : undefined}
                className={fieldErrors.username ? 'input-error' : undefined}
                required
              />
              {fieldErrors.username && (
                <p className="field-error">{fieldErrors.username}</p>
              )}
            </label>
          ) : mode === 'forgot' ? (
            <label>
              {t('common.email')}
              <input
                ref={emailRef}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError('email');
                }}
                placeholder={t('auth.emailPlaceholder')}
                aria-invalid={fieldErrors.email ? true : undefined}
                className={fieldErrors.email ? 'input-error' : undefined}
                required
              />
              {fieldErrors.email && (
                <p className="field-error">{fieldErrors.email}</p>
              )}
            </label>
          ) : (
            <>
              <label>
                {t('auth.fullName')}
                <input
                  type="text"
                  autoComplete="name"
                  enterKeyHint="next"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={t('common.optional')}
                />
              </label>
              <label>
                {t('common.email')}
                <input
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError('email');
                  }}
                  placeholder={t('auth.emailPlaceholder')}
                  aria-invalid={fieldErrors.email ? true : undefined}
                  className={fieldErrors.email ? 'input-error' : undefined}
                  required
                />
                {fieldErrors.email && (
                  <p className="field-error">{fieldErrors.email}</p>
                )}
              </label>
              <fieldset className="tag-fieldset auth-role-fieldset">
                <legend className="auth-role-legend">
                  {t('auth.roleLegend')}
                </legend>
                <p className="muted tag-hint">{t('auth.roleHint')}</p>
                <div
                  className="auth-role-options"
                  role="group"
                  aria-label={t('auth.roleLegend')}
                >
                  {ROLE_ORDER.map((id) => {
                    const selected = roles.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`role-option${selected ? ' role-option--selected' : ''}`}
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
                        <span className="role-option-icon" aria-hidden="true">
                          <RoleGlyph role={id} />
                        </span>
                        <span className="role-option-body">
                          <span className="role-option-title">
                            {t(ROLE_KEYS[id])}
                          </span>
                          <span className="role-option-desc">
                            {t(ROLE_DESC_KEYS[id])}
                          </span>
                        </span>
                        <span className="role-option-check" aria-hidden="true">
                          {selected ? <CheckIcon /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          {mode !== 'forgot' && (
            <label>
              {t('common.password')}
              <div className="password-field">
                <input
                  ref={passwordRef}
                  type={passwordVisible ? 'text' : 'password'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint={mode === 'signin' ? 'go' : 'done'}
                  autoComplete={
                    mode === 'signin' ? 'current-password' : 'new-password'
                  }
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFieldError('password');
                  }}
                  minLength={mode === 'signup' ? 8 : undefined}
                  aria-invalid={fieldErrors.password ? true : undefined}
                  className={fieldErrors.password ? 'input-error' : undefined}
                  required
                />
                <button
                  type="button"
                  className="password-visibility-toggle"
                  onClick={() => setPasswordVisible((prev) => !prev)}
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
              {fieldErrors.password && (
                <p className="field-error">{fieldErrors.password}</p>
              )}
            </label>
          )}

          {mode === 'signin' && (
            <p className="auth-forgot-row">
              <button
                type="button"
                className="text-link"
                onClick={() => switchMode('forgot')}
                disabled={submitting}
              >
                {t('auth.forgotPasswordLink')}
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <div className="auth-legal-consents">
              <label className="checkbox-label auth-legal-consent">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                  required
                  disabled={submitting}
                />
                <span>
                  {t('auth.acceptPrivacyPrefix')}{' '}
                  <Link
                    href="/privacy"
                    className="text-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('footer.privacyPolicy')}
                  </Link>
                </span>
              </label>
              {needsClientAgreement && (
                <label className="checkbox-label auth-legal-consent">
                  <input
                    type="checkbox"
                    checked={acceptedClientAgreement}
                    onChange={(event) =>
                      setAcceptedClientAgreement(event.target.checked)
                    }
                    required
                    disabled={submitting}
                  />
                  <span>
                    {t('auth.acceptClientAgreementPrefix')}{' '}
                    <Link
                      href="/client-agreement"
                      className="text-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('footer.clientAgreement')}
                    </Link>
                  </span>
                </label>
              )}
              {needsContractorAgreement && (
                <label className="checkbox-label auth-legal-consent">
                  <input
                    type="checkbox"
                    checked={acceptedContractorAgreement}
                    onChange={(event) =>
                      setAcceptedContractorAgreement(event.target.checked)
                    }
                    required
                    disabled={submitting}
                  />
                  <span>
                    {t('auth.acceptContractorAgreementPrefix')}{' '}
                    <Link
                      href="/contractor-agreement"
                      className="text-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('footer.contractorAgreement')}
                    </Link>
                  </span>
                </label>
              )}
            </div>
          )}

          {error && (
            <p className="form-error" ref={errorRef}>
              {error}
            </p>
          )}
          {successNotice && (
            <p className="auth-success-notice">{successNotice}</p>
          )}

          <button
            type="submit"
            className="primary auth-submit"
            disabled={submitting || (mode === 'signup' && !canSubmitSignup)}
          >
            {submitting
              ? mode === 'signin'
                ? t('auth.signingIn')
                : mode === 'forgot'
                  ? t('auth.sendingResetLink')
                  : t('auth.creatingAccount')
              : mode === 'signin'
                ? t('header.signIn')
                : mode === 'forgot'
                  ? t('auth.sendResetLink')
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
            ) : mode === 'forgot' ? (
              <>
                {t('auth.rememberedPassword')}{' '}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => switchMode('signin')}
                  disabled={submitting}
                >
                  {t('header.signIn')}
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
    </div>,
    document.body,
  );
}
