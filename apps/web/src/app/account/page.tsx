'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BecomeRoleModal } from '@/components/BecomeRoleModal';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  missingSelfServeRoles,
  type SelfServeAccountRole,
} from '@/lib/account-roles';
import {
  accountProfileName,
  isContractorUser,
  isDesignerUser,
  refreshSessionTokens,
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
  const [becomeRole, setBecomeRole] = useState<SelfServeAccountRole | null>(
    null,
  );
  const [roleNotice, setRoleNotice] = useState<string | null>(null);

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
  const isDesigner =
    me?.isDesigner || me?.roles?.includes('designer') || false;
  const isClient = Boolean(me?.roles?.includes('client'));

  const currentRoleLabels = useMemo(() => {
    if (!me) return [];
    const labels: string[] = [];
    if (isClient) labels.push(t('account.roleClient'));
    if (isContractor) labels.push(t('account.roleContractor'));
    if (isDesigner) labels.push(t('account.roleDesigner'));
    if (me.roles?.includes('admin')) labels.push(t('account.roleAdmin'));
    return labels;
  }, [me, isClient, isContractor, isDesigner, t]);

  const availableRoles = missingSelfServeRoles(me);

  const becomeLabel = (role: SelfServeAccountRole) => {
    if (role === 'client') return t('account.becomeClient');
    if (role === 'contractor') return t('account.becomeContractor');
    return t('account.becomeDesigner');
  };

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
                    {currentRoleLabels.length > 0
                      ? currentRoleLabels.join(' · ')
                      : t('common.dash')}
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
              {isDesigner && (
                <p className="muted account-profile-hint">
                  {t('account.designerHint')}{' '}
                  <Link href="/designer" className="text-link">
                    {t('account.designerPortal')}
                  </Link>
                  .
                </p>
              )}
            </section>

            <section className="card account-roles-card">
              <h2 className="section-title">{t('account.rolesHeading')}</h2>
              <p className="muted doc-hint">{t('account.rolesHint')}</p>
              {roleNotice ? (
                <p className="account-role-notice">{roleNotice}</p>
              ) : null}
              <ul className="account-role-chip-list" aria-label={t('account.rolesHeading')}>
                {currentRoleLabels.map((label) => (
                  <li key={label} className="account-role-chip">
                    {label}
                  </li>
                ))}
              </ul>
              {availableRoles.length > 0 ? (
                <div className="account-become-actions">
                  {availableRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setRoleNotice(null);
                        setBecomeRole(role);
                      }}
                    >
                      {becomeLabel(role)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted account-roles-complete">
                  {t('account.allRolesEnabled')}
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

                {(isContractor || isDesigner) ? (
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
                ) : null}
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

      <BecomeRoleModal
        role={becomeRole ?? 'client'}
        isOpen={becomeRole != null}
        onClose={() => setBecomeRole(null)}
        onSuccess={async () => {
          await refreshSessionTokens({ force: true });
          await refreshSession();
          await loadPrefs();
          setRoleNotice(t('account.roleAdded'));
        }}
      />
    </PageShell>
  );
}
