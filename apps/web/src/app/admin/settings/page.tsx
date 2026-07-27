'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  fetchAdminPlatformSettings,
  updateAdminPlatformSettings,
} from '@/lib/admin-settings';
import { isAdmin } from '@/lib/verification';

export default function AdminSettingsPage() {
  const { t } = useTranslation();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [draftEmail, setDraftEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    const settings = await fetchAdminPlatformSettings();
    setEmails(settings.contractSignedNotifyEmails);
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    setReady(true);
    if (me && isAdmin(me.roles)) {
      void loadSettings().catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : t('admin.settingsLoadFailed'),
        );
      });
    }
  }, [sessionReady, me, loadSettings, t]);

  const addEmail = () => {
    const email = draftEmail.trim().toLowerCase();
    if (!email) return;
    setError(null);
    setSaved(false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
      setError(t('admin.settingsInvalidEmail'));
      return;
    }
    if (emails.includes(email)) {
      setDraftEmail('');
      return;
    }
    setEmails((prev) => [...prev, email]);
    setDraftEmail('');
  };

  const removeEmail = (email: string) => {
    setSaved(false);
    setEmails((prev) => prev.filter((item) => item !== email));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let next = emails;
      const pending = draftEmail.trim().toLowerCase();
      if (pending) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(pending)) {
          throw new Error(t('admin.settingsInvalidEmail'));
        }
        if (!next.includes(pending)) {
          next = [...next, pending];
        }
      }
      const result = await updateAdminPlatformSettings({
        contractSignedNotifyEmails: next,
      });
      setEmails(result.contractSignedNotifyEmails);
      setDraftEmail('');
      setSaved(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('admin.settingsSaveFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />
      <main className="content-container main-content">
        <section className="page-hero">
          <h1>{t('admin.settingsTitle')}</h1>
          <p className="page-hero-lead muted">{t('admin.settingsLead')}</p>
        </section>

        {!ready && <p className="muted">{t('common.loading')}</p>}

        {ready && !me && (
          <section className="card">
            <p>{t('admin.signInPrompt')}</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              {t('header.signIn')}
            </button>
          </section>
        )}

        {ready && me && !isAdmin(me.roles) && (
          <section className="card error">
            <p>{t('admin.roleRequired')}</p>
          </section>
        )}

        {ready && me && isAdmin(me.roles) && (
          <section className="card">
            <div className="account-notifications-header">
              <h2 className="section-title">
                {t('admin.settingsContractSignedEmails')}
              </h2>
              {saved && !error && (
                <span className="account-saved-badge">{t('common.saved')}</span>
              )}
            </div>
            <p className="muted doc-hint">
              {t('admin.settingsContractSignedEmailsHelp')}
            </p>

            {error && <p className="error">{error}</p>}

            <form className="admin-directory-form" onSubmit={(e) => void handleSave(e)}>
              <ul className="admin-email-list">
                {emails.length === 0 && (
                  <li className="muted">{t('admin.settingsEmailsEmpty')}</li>
                )}
                {emails.map((email) => (
                  <li key={email} className="admin-email-row">
                    <span>{email}</span>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => removeEmail(email)}
                    >
                      {t('common.remove')}
                    </button>
                  </li>
                ))}
              </ul>

              <label>
                {t('admin.settingsAddEmail')}
                <div className="admin-email-add-row">
                  <input
                    type="email"
                    value={draftEmail}
                    onChange={(e) => {
                      setDraftEmail(e.target.value);
                      setSaved(false);
                    }}
                    placeholder="ops@example.com"
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEmail();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || !draftEmail.trim()}
                    onClick={addEmail}
                  >
                    {t('admin.settingsAdd')}
                  </button>
                </div>
              </label>

              <button type="submit" className="primary" disabled={busy}>
                {busy ? t('common.pleaseWait') : t('admin.settingsSave')}
              </button>
            </form>
          </section>
        )}
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          void (async () => {
            const session = await refreshSession();
            if (session && isAdmin(session.roles)) {
              await loadSettings();
            }
          })();
        }}
      />
    </>
  );
}
