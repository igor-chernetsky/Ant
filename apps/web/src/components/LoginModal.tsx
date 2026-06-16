'use client';

import { FormEvent, useState } from 'react';
import { loginWithPassword, signupWithPassword } from '@/lib/session';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roles, setRoles] = useState<string[]>(['client']);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'signin') {
        await loginWithPassword(username, password);
      } else {
        await signupWithPassword({
          email,
          password,
          displayName: displayName.trim() || undefined,
          roles,
        });
      }
      setMode('signin');
      setEmail('');
      setUsername('');
      setPassword('');
      setDisplayName('');
      setRoles(['client']);
      await onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'signin'
            ? 'Sign in failed'
            : 'Sign up failed',
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
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="muted modal-subtitle">
          {mode === 'signin'
            ? 'Sign in to manage projects and contractor bids.'
            : 'Join Ant to publish projects or respond to tenders.'}
        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          {mode === 'signin' ? (
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
          ) : (
            <>
              <label>
                Full name
                <input
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <fieldset className="tag-fieldset">
                <legend>I am a…</legend>
                <p className="muted tag-hint">
                  Choose how you will use the platform. You can update this later.
                </p>
                <div className="tag-picker">
                  {[
                    { id: 'client', label: 'Client' },
                    { id: 'contractor', label: 'Contractor' },
                    { id: 'designer', label: 'Designer' },
                  ].map((role) => {
                    const selected = roles.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        className={`tag-chip ${selected ? 'tag-chip-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() =>
                          setRoles((prev) => {
                            if (prev.includes(role.id)) {
                              const next = prev.filter((r) => r !== role.id);
                              return next.length > 0 ? next : ['client'];
                            }
                            return [...prev, role.id];
                          })
                        }
                        disabled={submitting}
                      >
                        {role.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          <label>
            Password
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

          <button type="submit" className="primary auth-submit" disabled={submitting}>
            {submitting
              ? mode === 'signin'
                ? 'Signing in…'
                : 'Creating account…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>

          <p className="auth-mode-footer muted">
            {mode === 'signin' ? (
              <>
                New to Ant?{' '}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => switchMode('signup')}
                  disabled={submitting}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => switchMode('signin')}
                  disabled={submitting}
                >
                  Sign in
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
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
