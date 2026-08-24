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
import {
  fetchLocationCatalog,
  formatServiceLocation,
  type LocationCatalog,
} from '@/lib/locations';

interface InviteFromDirectoryModalProps {
  projectId: string;
  projectType?: string | null;
  locationRegionSlug?: string | null;
  locationAreaSlug?: string | null;
  tagSlugs?: string[];
  onClose: () => void;
  /** Admin send-project invites: show-all toggle + unregistered-only list. */
  variant?: 'client' | 'admin';
}

const KINDS: SupplyDirectoryKind[] = ['contractor', 'designer', 'supplier'];
const CLIENT_DIRECTORY_INVITE_MAX = 3;

export function InviteFromDirectoryModal({
  projectId,
  projectType,
  locationRegionSlug,
  locationAreaSlug,
  tagSlugs,
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
  const [locationCatalog, setLocationCatalog] =
    useState<LocationCatalog | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchLocationCatalog()
      .then((catalog) => {
        if (!cancelled) setLocationCatalog(catalog);
      })
      .catch(() => {
        if (!cancelled) setLocationCatalog(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tagSlugsKey = (tagSlugs ?? []).join(',');

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
      locationRegionSlug,
      locationAreaSlug,
      tagSlugs: tagSlugsKey ? tagSlugsKey.split(',') : undefined,
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
  }, [
    kind,
    showAllKinds,
    isAdmin,
    suggestedKind,
    locationRegionSlug,
    locationAreaSlug,
    tagSlugsKey,
    t,
  ]);

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

  const formatEntryLocations = (entry: SupplyDirectoryEntry) => {
    if (entry.serviceLocations.length === 0) {
      return t('directory.locationsAny');
    }
    if (!locationCatalog) {
      return entry.serviceLocations
        .map((loc) =>
          loc.areaSlug
            ? `${loc.areaSlug}, ${loc.regionSlug}`
            : loc.regionSlug,
        )
        .join(' · ');
    }
    return entry.serviceLocations
      .map((loc) => formatServiceLocation(locationCatalog, loc))
      .join(' · ');
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (!isAdmin && next.size >= CLIENT_DIRECTORY_INVITE_MAX) {
        setError(
          t('directory.inviteMaxReached', {
            max: String(CLIENT_DIRECTORY_INVITE_MAX),
          }),
        );
        return prev;
      }
      next.add(id);
      return next;
    });
  };

  const handleInviteSelected = async () => {
    if (selectedCount === 0) return;
    if (!isAdmin && selectedCount > CLIENT_DIRECTORY_INVITE_MAX) {
      setError(
        t('directory.inviteMaxReached', {
          max: String(CLIENT_DIRECTORY_INVITE_MAX),
        }),
      );
      return;
    }
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

        <div className="publish-tender-modal-body invite-directory-modal-body">
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
          {!isAdmin && (
            <p className="muted">
              {t('directory.inviteMaxHint', {
                max: String(CLIENT_DIRECTORY_INVITE_MAX),
              })}
            </p>
          )}

          {loading ? (
            <p className="muted">{t('directory.loading')}</p>
          ) : entries.length === 0 ? (
            <p className="muted">
              {isAdmin
                ? t('directory.emptyUnregistered')
                : t('directory.empty')}
            </p>
          ) : (
            <div className="directory-invite-table-wrap">
              <table className="directory-invite-table">
                <thead>
                  <tr>
                    <th scope="col" className="directory-invite-col-check">
                      <span className="sr-only">
                        {t('directory.selectColumn')}
                      </span>
                    </th>
                    <th scope="col">{t('directory.companyColumn')}</th>
                    <th scope="col">{t('directory.contactColumn')}</th>
                    <th scope="col">{t('directory.emailColumn')}</th>
                    {isAdmin && showAllKinds ? (
                      <th scope="col">{t('directory.kindColumn')}</th>
                    ) : null}
                    <th scope="col">{t('directory.locationsColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={
                        selected.has(entry.id)
                          ? 'directory-invite-row--selected'
                          : undefined
                      }
                      onClick={() => {
                        if (!busy) toggle(entry.id);
                      }}
                    >
                      <td className="directory-invite-col-check">
                        <input
                          type="checkbox"
                          checked={selected.has(entry.id)}
                          onChange={() => toggle(entry.id)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={
                            busy ||
                            (!isAdmin &&
                              !selected.has(entry.id) &&
                              selectedCount >= CLIENT_DIRECTORY_INVITE_MAX)
                          }
                          aria-label={entry.companyName}
                        />
                      </td>
                      <td>
                        <span className="directory-invite-company">
                          {entry.companyName}
                        </span>
                      </td>
                      <td className="muted">
                        {entry.contactName?.trim() || t('common.dash')}
                      </td>
                      <td>
                        <span className="directory-invite-email">
                          {entry.email}
                        </span>
                      </td>
                      {isAdmin && showAllKinds ? (
                        <td className="muted">{kindLabel[entry.kind]}</td>
                      ) : null}
                      <td className="muted directory-invite-locations">
                        {formatEntryLocations(entry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
