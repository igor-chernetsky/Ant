'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notification-preferences';

const MATCHING_CAP = 3;

export default function AccountPage() {
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadPrefs = useCallback(async () => {
    if (!me) {
      setPrefs(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotificationPreferences();
      setPrefs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    if (!sessionReady) return;
    void loadPrefs();
  }, [sessionReady, loadPrefs]);

  const handleToggle = async (
    key: keyof NotificationPreferences,
    value: boolean,
  ) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await updateNotificationPreferences({ [key]: value });
      setPrefs(updated);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setPrefs(prefs);
    } finally {
      setBusy(false);
    }
  };

  const isContractor =
    me?.isContractor || me?.roles?.includes('contractor') || false;

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />

      <main className="content-container main-content account-page">
        <header className="account-page-header">
          <p className="account-page-kicker">
            <Link href="/" className="project-hero-back-link">
              Home
            </Link>
            <span className="project-hero-kicker-sep" aria-hidden>
              /
            </span>
            <span>Account</span>
          </p>
          <h1 className="account-page-title">Your account</h1>
        </header>

        {!sessionReady || loading ? (
          <section className="card">
            <p className="muted">Loading…</p>
          </section>
        ) : null}

        {!loading && !me && (
          <section className="card">
            <p className="muted">Sign in to manage your account and notifications.</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              Sign in
            </button>
          </section>
        )}

        {error && (
          <section className="card error">
            <p>{error}</p>
          </section>
        )}

        {!loading && me && prefs && (
          <>
            <section className="card account-profile-card">
              <h2 className="section-title">Profile</h2>
              <dl className="meta-grid account-profile-meta">
                <div>
                  <dt>Name</dt>
                  <dd>{me.displayName ?? '—'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{me.email ?? '—'}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>
                    {isContractor ? 'Contractor' : 'Client'}
                    {me.roles?.includes('admin') ? ' · Admin' : ''}
                  </dd>
                </div>
              </dl>
              {isContractor && (
                <p className="muted account-profile-hint">
                  Update contractor profile and specialties on the{' '}
                  <Link href="/contractor" className="text-link">
                    Contractor portal
                  </Link>
                  .
                </p>
              )}
            </section>

            <section className="card account-notifications-card">
              <div className="account-notifications-header">
                <h2 className="section-title">Email notifications</h2>
                {saved && <span className="account-saved-badge">Saved</span>}
              </div>
              <p className="muted doc-hint">
                Choose which updates we send to {me.email}. You can turn
                everything off at any time.
              </p>

              <ul className="account-notification-list">
                <li className="account-notification-item">
                  <label className="account-notification-toggle">
                    <input
                      type="checkbox"
                      checked={prefs.emailEnabled}
                      disabled={busy}
                      onChange={(e) =>
                        void handleToggle('emailEnabled', e.target.checked)
                      }
                    />
                    <span>
                      <strong>All email notifications</strong>
                      <span className="muted account-notification-desc">
                        Master switch for Ant emails
                      </span>
                    </span>
                  </label>
                </li>

                <li className="account-notification-item">
                  <label className="account-notification-toggle">
                    <input
                      type="checkbox"
                      checked={
                        prefs.emailEnabled && prefs.emailClientBidActivity
                      }
                      disabled={busy || !prefs.emailEnabled}
                      onChange={(e) =>
                        void handleToggle(
                          'emailClientBidActivity',
                          e.target.checked,
                        )
                      }
                    />
                    <span>
                      <strong>Bids on my projects</strong>
                      <span className="muted account-notification-desc">
                        New applications, proposals, and messages from
                        contractors
                      </span>
                    </span>
                  </label>
                </li>

                {isContractor && (
                  <>
                    <li className="account-notification-item">
                      <label className="account-notification-toggle">
                        <input
                          type="checkbox"
                          checked={
                            prefs.emailEnabled && prefs.emailContractorUpdates
                          }
                          disabled={busy || !prefs.emailEnabled}
                          onChange={(e) =>
                            void handleToggle(
                              'emailContractorUpdates',
                              e.target.checked,
                            )
                          }
                        />
                        <span>
                          <strong>My bid activity</strong>
                          <span className="muted account-notification-desc">
                            Client messages, counter-offers, and tender outcomes
                          </span>
                        </span>
                      </label>
                    </li>

                    <li className="account-notification-item">
                      <label className="account-notification-toggle">
                        <input
                          type="checkbox"
                          checked={
                            prefs.emailEnabled && prefs.emailMatchingProjects
                          }
                          disabled={busy || !prefs.emailEnabled}
                          onChange={(e) =>
                            void handleToggle(
                              'emailMatchingProjects',
                              e.target.checked,
                            )
                          }
                        />
                        <span>
                          <strong>Matching new projects</strong>
                          <span className="muted account-notification-desc">
                            Projects that match your specialties (up to{' '}
                            {MATCHING_CAP} emails per day)
                          </span>
                        </span>
                      </label>
                    </li>
                  </>
                )}
              </ul>
            </section>
          </>
        )}
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          void (async () => {
            await refreshSession();
            await loadPrefs();
          })();
        }}
      />
    </PageShell>
  );
}
