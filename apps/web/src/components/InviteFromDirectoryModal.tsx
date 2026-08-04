'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/components/LocaleProvider';
import {
  fetchDirectoryEntries,
  inviteDirectoryEntriesToTender,
  inviteManualRecipientToTender,
  suggestedDirectoryKind,
  type SupplyDirectoryEntry,
  type SupplyDirectoryKind,
} from '@/lib/directory';

interface InviteFromDirectoryModalProps {
  projectId: string;
  projectType?: string | null;
  onClose: () => void;
  /** Admin send-project invites: show-all toggle + unregistered-only list. */
  variant?: 'client' | 'admin';
}

const KINDS: SupplyDirectoryKind[] = ['contractor', 'designer', 'supplier'];

export function InviteFromDirectoryModal({
  projectId,
  projectType,
  onClose,
  variant = 'client',
}: InviteFromDirectoryModalProps) {
  const { t } = useTranslation();
  const isAdmin = variant === 'admin';
  const suggestedKind = suggestedDirectoryKind(projectType);
  const [kind, setKind] = useState<SupplyDirectoryKind>(suggestedKind);
  const [showAllKinds, setShowAllKinds] = useState(false);
  const [entries, setEntries] = useState<SupplyDirectoryEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const listKind = isAdmin
      ? showAllKinds
        ? undefined
        : suggestedKind
      : kind;
    void fetchDirectoryEntries(listKind, {
      excludeRegistered: true,
    })
      .then((list) => {
        if (!cancelled) {
          setEntries(list);
          setSelected(new Set());
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t('directory.loadFailed'),
          );
          setEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, showAllKinds, isAdmin, suggestedKind, t]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const selectedCount = selected.size;

  const kindLabel = useMemo(
    () => ({
      contractor: t('directory.kindContractor'),
      designer: t('directory.kindDesigner'),
      supplier: t('directory.kindSupplier'),
    }),
    [t],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInviteSelected = async () => {
    if (selectedCount === 0) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const results = await inviteDirectoryEntriesToTender(projectId, [
        ...selected,
      ]);
      const sent = results.filter((r) => r.emailSent).length;
      setSuccess(
        t('directory.inviteSent', {
          count: String(results.length),
          sent: String(sent),
        }),
      );
      setSelected(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('directory.inviteFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleManualInvite = async () => {
    const email = manualEmail.trim();
    if (!email) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await inviteManualRecipientToTender(projectId, {
        email,
        name: manualName.trim() || undefined,
        kind: isAdmin ? suggestedKind : kind,
      });
      setSuccess(
        result.emailSent
          ? t('directory.manualInviteSent')
          : t('directory.manualInviteSavedNoEmail'),
      );
      setManualEmail('');
      setManualName('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('directory.inviteFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal modal--wide publish-tender-modal invite-directory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-directory-title"
      >
        <div className="publish-tender-modal-chrome">
          <div className="modal-header">
            <h2 id="invite-directory-title">
              {isAdmin
                ? t('directory.adminInviteTitle')
                : t('directory.inviteTitle')}
            </h2>
            <button
              type="button"
              className="icon-button"
              aria-label={t('common.close')}
              disabled={busy}
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <p className="muted modal-subtitle publish-tender-modal-subtitle">
            {isAdmin
              ? t('directory.adminInviteLead')
              : t('directory.inviteLead')}
          </p>
        </div>

        <div className="publish-tender-modal-body modal-form">
          {isAdmin && (
            <label className="directory-show-all">
              <input
                type="checkbox"
                checked={showAllKinds}
                onChange={(e) => setShowAllKinds(e.target.checked)}
                disabled={busy}
              />
              <span>{t('directory.showAllKinds')}</span>
            </label>
          )}

          {!isAdmin && (
            <div className="directory-kind-tabs" role="tablist">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  className={kind === k ? 'primary' : 'secondary'}
                  onClick={() => setKind(k)}
                  disabled={busy}
                >
                  {kindLabel[k]}
                </button>
              ))}
            </div>
          )}

          {error && <p className="error">{error}</p>}
          {success && <p className="muted">{success}</p>}

          {loading ? (
            <p className="muted">{t('directory.loading')}</p>
          ) : entries.length === 0 ? (
            <p className="muted">
              {isAdmin
                ? t('directory.emptyUnregistered')
                : t('directory.empty')}
            </p>
          ) : (
            <ul className="directory-invite-list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <label className="directory-invite-row">
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggle(entry.id)}
                      disabled={busy}
                    />
                    <span>
                      <strong>{entry.companyName}</strong>
                      <span className="muted directory-invite-meta">
                        {isAdmin && showAllKinds
                          ? `${kindLabel[entry.kind]} · `
                          : ''}
                        {entry.contactName ? `${entry.contactName} · ` : ''}
                        {entry.email}
                        {entry.regionSlug ? ` · ${entry.regionSlug}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="directory-manual-invite">
            <h3>{t('directory.manualInviteTitle')}</h3>
            <div className="form-row">
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder={t('directory.emailPlaceholder')}
                disabled={busy}
              />
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder={t('directory.namePlaceholder')}
                disabled={busy}
              />
            </div>
          </div>
        </div>

        <div className="publish-tender-modal-footer row">
          <button
            type="button"
            className="secondary"
            disabled={busy || !manualEmail.trim()}
            onClick={() => void handleManualInvite()}
          >
            {t('directory.sendManualInvite')}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || selectedCount === 0}
            onClick={() => void handleInviteSelected()}
          >
            {busy
              ? t('directory.sending')
              : t('directory.sendInvites', { count: String(selectedCount) })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
