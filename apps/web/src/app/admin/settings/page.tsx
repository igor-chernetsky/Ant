'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { FlashToast, type FlashToastState } from '@/components/FlashToast';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { SettingsBroadcastEditor } from '@/components/SettingsBroadcastEditor';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  BROADCAST_ATTACHMENT_ACCEPT,
  BROADCAST_MAX_ATTACHMENTS,
  BROADCAST_MAX_ATTACHMENT_BYTES,
  encodeBroadcastAttachment,
  fetchAdminPlatformSettings,
  sendAdminBroadcast,
  updateAdminPlatformSettings,
  validateBroadcastAttachmentFile,
  type BroadcastAttachmentDraft,
} from '@/lib/admin-settings';
import { formatFileSize } from '@/lib/documents';
import { isAdmin } from '@/lib/verification';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

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

  const [broadcastTo, setBroadcastTo] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastHtml, setBroadcastHtml] = useState('<p></p>');
  const [broadcastBodyEmpty, setBroadcastBodyEmpty] = useState(true);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastFlash, setBroadcastFlash] = useState<FlashToastState | null>(
    null,
  );
  const [broadcastAttachments, setBroadcastAttachments] = useState<
    BroadcastAttachmentDraft[]
  >([]);
  const [broadcastResetKey, setBroadcastResetKey] = useState(0);

  const broadcastAttachmentTotalBytes = broadcastAttachments.reduce(
    (sum, item) => sum + item.file.size,
    0,
  );

  const dismissBroadcastFlash = useCallback(() => {
    setBroadcastFlash(null);
  }, []);

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
    if (!EMAIL_RE.test(email)) {
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
        if (!EMAIL_RE.test(pending)) {
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

  const handleBroadcastBodyChange = useCallback(
    (html: string, isEmpty: boolean) => {
      setBroadcastHtml(html);
      setBroadcastBodyEmpty(isEmpty);
    },
    [],
  );

  const handleBroadcastAttachmentsChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    let nextAttachments = [...broadcastAttachments];
    let nextTotalBytes = broadcastAttachmentTotalBytes;

    for (const file of files) {
      const validationError = validateBroadcastAttachmentFile(
        file,
        nextAttachments.length,
        nextTotalBytes,
        t,
        formatFileSize,
      );
      if (validationError) {
        setBroadcastFlash({ tone: 'error', message: validationError });
        return;
      }
      nextAttachments = [
        ...nextAttachments,
        { id: `${file.name}-${file.size}-${file.lastModified}`, file },
      ];
      nextTotalBytes += file.size;
    }

    setBroadcastAttachments(nextAttachments);
  };

  const removeBroadcastAttachment = (id: string) => {
    setBroadcastAttachments((current) =>
      current.filter((item) => item.id !== id),
    );
  };

  const handleBroadcastSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const to = broadcastTo.trim().toLowerCase();
    if (!EMAIL_RE.test(to)) {
      setBroadcastFlash({
        tone: 'error',
        message: t('admin.settingsInvalidEmail'),
      });
      return;
    }
    if (!broadcastSubject.trim() || broadcastBodyEmpty) {
      setBroadcastFlash({
        tone: 'error',
        message: t('admin.settingsBroadcastIncomplete'),
      });
      return;
    }

    setBroadcastBusy(true);
    try {
      const attachments = await Promise.all(
        broadcastAttachments.map((item) => encodeBroadcastAttachment(item.file)),
      );
      const result = await sendAdminBroadcast({
        to,
        subject: broadcastSubject.trim(),
        html: broadcastHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setBroadcastFlash({
        tone: 'success',
        message: t('admin.settingsBroadcastSent', { from: result.from, to }),
      });
      setBroadcastSubject('');
      setBroadcastTo('');
      setBroadcastHtml('<p></p>');
      setBroadcastBodyEmpty(true);
      setBroadcastAttachments([]);
      setBroadcastResetKey((n) => n + 1);
    } catch (err: unknown) {
      setBroadcastFlash({
        tone: 'error',
        message:
          err instanceof Error
            ? err.message
            : t('admin.settingsBroadcastSendFailed'),
      });
    } finally {
      setBroadcastBusy(false);
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
          <div className="admin-settings-layout">
            <section className="card admin-settings-panel">
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

              <form
                className="admin-settings-emails-form"
                onSubmit={(e) => void handleSave(e)}
              >
                <label className="admin-settings-field">
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

                <ul className="admin-email-list">
                  {emails.length === 0 && (
                    <li className="muted">{t('admin.settingsEmailsEmpty')}</li>
                  )}
                  {emails.map((email) => (
                    <li key={email} className="admin-email-row">
                      <span className="admin-email-row-address">{email}</span>
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

                <div className="admin-settings-actions">
                  <button type="submit" className="primary" disabled={busy}>
                    {busy ? t('common.pleaseWait') : t('admin.settingsSave')}
                  </button>
                </div>
              </form>
            </section>

            <section className="card admin-settings-panel">
              <h2 className="section-title">{t('admin.settingsBroadcastTitle')}</h2>
              <p className="muted doc-hint">{t('admin.settingsBroadcastHelp')}</p>

              <form
                className="admin-settings-broadcast-form"
                onSubmit={(e) => void handleBroadcastSubmit(e)}
              >
                <label className="admin-settings-field">
                  {t('admin.settingsBroadcastTo')}
                  <input
                    type="email"
                    value={broadcastTo}
                    onChange={(e) => setBroadcastTo(e.target.value)}
                    placeholder="recipient@example.com"
                    autoComplete="email"
                    disabled={broadcastBusy}
                  />
                </label>

                <label className="admin-settings-field">
                  {t('admin.settingsBroadcastSubject')}
                  <input
                    type="text"
                    value={broadcastSubject}
                    onChange={(e) => setBroadcastSubject(e.target.value)}
                    placeholder={t('admin.settingsBroadcastSubjectPlaceholder')}
                    disabled={broadcastBusy}
                  />
                </label>

                <div className="admin-settings-field">
                  <span className="admin-settings-field-label">
                    {t('admin.settingsBroadcastBody')}
                  </span>
                  <SettingsBroadcastEditor
                    resetKey={broadcastResetKey}
                    onChange={handleBroadcastBodyChange}
                  />
                </div>

                <div className="admin-settings-field">
                  <span className="admin-settings-field-label">
                    {t('admin.settingsBroadcastAttachments')}
                  </span>
                  <p className="muted admin-settings-attachments-hint">
                    {t('admin.settingsBroadcastAttachmentsHint', {
                      maxFiles: BROADCAST_MAX_ATTACHMENTS,
                      maxSize: formatFileSize(BROADCAST_MAX_ATTACHMENT_BYTES),
                    })}
                  </p>
                  <div className="admin-settings-attachments">
                    <label className="secondary admin-settings-attachments-add">
                      {t('admin.settingsBroadcastAttachmentsAdd')}
                      <input
                        type="file"
                        multiple
                        accept={BROADCAST_ATTACHMENT_ACCEPT}
                        disabled={
                          broadcastBusy ||
                          broadcastAttachments.length >= BROADCAST_MAX_ATTACHMENTS
                        }
                        onChange={handleBroadcastAttachmentsChange}
                      />
                    </label>
                    {broadcastAttachments.length === 0 ? (
                      <p className="muted admin-settings-attachments-empty">
                        {t('admin.settingsBroadcastAttachmentsEmpty')}
                      </p>
                    ) : (
                      <ul className="admin-settings-attachments-list">
                        {broadcastAttachments.map((item) => (
                          <li
                            key={item.id}
                            className="admin-settings-attachments-item"
                          >
                            <span className="admin-settings-attachments-name">
                              {item.file.name}
                            </span>
                            <span className="muted admin-settings-attachments-meta">
                              {formatFileSize(item.file.size)}
                            </span>
                            <button
                              type="button"
                              className="secondary"
                              disabled={broadcastBusy}
                              onClick={() => removeBroadcastAttachment(item.id)}
                            >
                              {t('common.remove')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="admin-settings-actions">
                  <button
                    type="submit"
                    className="primary"
                    disabled={
                      broadcastBusy ||
                      !broadcastTo.trim() ||
                      !broadcastSubject.trim() ||
                      broadcastBodyEmpty
                    }
                  >
                    {broadcastBusy
                      ? t('common.pleaseWait')
                      : t('admin.settingsBroadcastSend')}
                  </button>
                </div>
              </form>
            </section>
          </div>
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

      <FlashToast toast={broadcastFlash} onDismiss={dismissBroadcastFlash} />
    </>
  );
}
