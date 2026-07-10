'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  accountProfileName,
  isContractorUser,
} from '@/lib/session';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notification-preferences';

const MATCHING_CAP = 3;

export default function AccountPage() {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t('account.loadFailed'));
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, [me, t]);

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
      setError(err instanceof Error ? err.message : t('account.saveFailed'));
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
              {t('common.home')}
            </Link>
            <span className="project-hero-kicker-sep" aria-hidden>
              /
            </span>
            <span>{t('account.breadcrumb')}</span>
          </p>
          <h1 className="account-page-title">{t('account.title')}</h1>
        </header>

        {!sessionReady || loading ? (
          <section className="card">
            <p className="muted">{t('common.loading')}</p>
          </section>
        ) : null}

        {!loading && !me && (
          <section className="card">
            <p className="muted">{t('account.signInPrompt')}</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              {t('header.signIn')}
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
              <h2 className="section-title">{t('account.profile')}</h2>
              <dl className="meta-grid account-profile-meta">
                <div>
                  <dt>
                    {isContractorUser(me)
                      ? t('account.companyName')
                      : t('account.name')}
                  </dt>
                  <dd>{accountProfileName(me) ?? t('common.dash')}</dd>
                </div>
                <div>
                  <dt>{t('common.email')}</dt>
                  <dd>{me.email ?? t('common.dash')}</dd>
                </div>
                <div>
                  <dt>{t('account.role')}</dt>
                  <dd>
                    {isContractor
                      ? t('account.roleContractor')
                      : t('account.roleClient')}
                    {me.roles?.includes('admin')
                      ? ` · ${t('account.roleAdmin')}`
                      : ''}
                  </dd>
                </div>
              </dl>
              {isContractor && (
                <p className="muted account-profile-hint">
                  {t('account.contractorHint')}{' '}
                  <Link href="/contractor" className="text-link">
                    {t('account.contractorPortal')}
                  </Link>
                  .
                </p>
              )}
            </section>

            <section className="card account-notifications-card">
              <div className="account-notifications-header">
                <h2 className="section-title">{t('account.emailNotifications')}</h2>
                {saved && (
                  <span className="account-saved-badge">{t('common.saved')}</span>
                )}
              </div>
              <p className="muted doc-hint">
                {t('account.emailNotificationsHint', {
                  email: me.email ?? t('common.dash'),
                })}
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
                      <strong>{t('account.allEmailNotifications')}</strong>
                      <span className="muted account-notification-desc">
                        {t('account.allEmailNotificationsDesc')}
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
                      <strong>{t('account.bidsOnProjects')}</strong>
                      <span className="muted account-notification-desc">
                        {t('account.bidsOnProjectsDesc')}
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
                          <strong>{t('account.myBidActivity')}</strong>
                          <span className="muted account-notification-desc">
                            {t('account.myBidActivityDesc')}
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
                          <strong>{t('account.matchingProjects')}</strong>
                          <span className="muted account-notification-desc">
                            {t('account.matchingProjectsDesc', {
                              cap: MATCHING_CAP,
                            })}
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
