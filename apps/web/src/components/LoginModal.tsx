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
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <div className="modal-header">
          <h2 id="login-modal-title">Sign in</h2>
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
          Access your projects and contractor tools.
        </p>

        <div className="auth-mode-toggle" role="tablist" aria-label="Auth mode">
          <button
            type="button"
            className={`secondary ${mode === 'signin' ? 'auth-mode-active' : ''}`}
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            disabled={submitting}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`secondary ${mode === 'signup' ? 'auth-mode-active' : ''}`}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            disabled={submitting}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {mode === 'signin' ? (
            <label>
              Email or username
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
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
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <fieldset className="tag-fieldset">
                <legend>How will you use Ant?</legend>
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

          <div className="row">
            <button
              type="submit"
              className="primary"
              disabled={submitting}
            >
              {submitting
                ? mode === 'signin'
                  ? 'Signing in…'
                  : 'Creating account…'
                : mode === 'signin'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
