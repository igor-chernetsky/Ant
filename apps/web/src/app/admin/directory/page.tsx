'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { ServiceLocationEditor } from '@/components/ServiceLocationEditor';
import { SiteHeader } from '@/components/SiteHeader';
import { TradeTagPicker } from '@/components/TradeTagPicker';
import { useSession } from '@/components/SessionProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  createAdminDirectoryEntry,
  deleteAdminDirectoryEntry,
  fetchAdminDirectoryEntries,
  updateAdminDirectoryEntry,
  type SupplyDirectoryEntry,
  type SupplyDirectoryKind,
  type UpsertDirectoryEntryInput,
} from '@/lib/directory';
import {
  fetchLocationCatalog,
  formatServiceLocation,
  type LocationCatalog,
  type ServiceLocation,
} from '@/lib/locations';
import { fetchPublicTags } from '@/lib/public-projects';
import { isAdmin } from '@/lib/verification';

const EMPTY_FORM: UpsertDirectoryEntryInput = {
  kind: 'contractor',
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  serviceLocations: [],
  tagSlugs: [],
  notes: '',
};

const KINDS: Array<SupplyDirectoryKind | ''> = [
  '',
  'contractor',
  'designer',
  'supplier',
];

export default function AdminDirectoryPage() {
  const { t } = useTranslation();
  const { formatTagLabel } = useAppFormatters();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<SupplyDirectoryKind | ''>('');
  const [list, setList] = useState<SupplyDirectoryEntry[]>([]);
  const [form, setForm] = useState<UpsertDirectoryEntryInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [locationCatalog, setLocationCatalog] =
    useState<LocationCatalog | null>(null);
  const [tradeTags, setTradeTags] = useState<
    Array<{
      slug: string;
      label: string;
      groupSlug: string | null;
      groupLabel: string | null;
    }>
  >([]);

  const specialtyTags = useMemo(
    () => tradeTags.filter((tag) => tag.groupSlug !== 'service'),
    [tradeTags],
  );

  const loadList = useCallback(async () => {
    const items = await fetchAdminDirectoryEntries(filter || undefined);
    setList(items);
  }, [filter]);

  useEffect(() => {
    if (!sessionReady) return;
    setReady(true);
    if (me && isAdmin(me.roles)) {
      void Promise.all([
        loadList(),
        fetchLocationCatalog(),
        fetchPublicTags(),
      ])
        .then(([, locations, tags]) => {
          setLocationCatalog(locations);
          setTradeTags(tags);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : t('common.loadFailed'));
        });
    }
  }, [sessionReady, me, loadList, t]);

  useEffect(() => {
    if (!ready || !me || !isAdmin(me.roles)) return;
    void loadList().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t('admin.loadListFailed'));
    });
  }, [filter, ready, me, loadList, t]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (entry: SupplyDirectoryEntry) => {
    setEditingId(entry.id);
    setForm({
      kind: entry.kind,
      companyName: entry.companyName,
      contactName: entry.contactName ?? '',
      email: entry.email,
      phone: entry.phone ?? '',
      website: entry.website ?? '',
      serviceLocations: entry.serviceLocations ?? [],
      tagSlugs: entry.tagSlugs ?? [],
      notes: entry.notes ?? '',
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload: UpsertDirectoryEntryInput = {
        ...form,
        serviceLocations: form.serviceLocations ?? [],
        tagSlugs: form.tagSlugs ?? [],
      };
      if (editingId) {
        await updateAdminDirectoryEntry(editingId, payload);
      } else {
        await createAdminDirectoryEntry(payload);
      }
      resetForm();
      await loadList();
    } catch (err: unknown) {
      const raw =
        err instanceof Error
          ? err.message
          : editingId
            ? t('admin.directoryUpdateFailed')
            : t('admin.directoryCreateFailed');
      if (raw.includes('already in the supply registry')) {
        setError(t('admin.directoryEmailInRegistry'));
      } else if (raw.includes('already belongs to a registered user')) {
        setError(t('admin.directoryEmailRegistered'));
      } else {
        setError(raw);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.directoryConfirmDelete'))) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminDirectoryEntry(id);
      if (editingId === id) resetForm();
      await loadList();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('admin.directoryDeleteFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const kindLabel = (kind: SupplyDirectoryKind | '') => {
    if (kind === 'designer') return t('admin.directoryKindDesigner');
    if (kind === 'supplier') return t('admin.directoryKindSupplier');
    if (kind === 'contractor') return t('admin.directoryKindContractor');
    return t('admin.filterAll');
  };

  const formatLocations = (locations: ServiceLocation[]) => {
    if (!locationCatalog || locations.length === 0) {
      return t('admin.directoryLocationsAny');
    }
    return locations
      .map((loc) => formatServiceLocation(locationCatalog, loc))
      .join(' · ');
  };

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />
      <main className="content-container content-container--wide main-content admin-directory-page">
        <section className="page-hero admin-directory-hero">
          <div>
            <h1>{t('admin.directoryTitle')}</h1>
            <p className="page-hero-lead muted">{t('admin.directoryLead')}</p>
          </div>
          {ready && me && isAdmin(me.roles) && (
            <p className="muted admin-directory-count">
              {t('admin.directoryCount', { count: String(list.length) })}
            </p>
          )}
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
          <>
            {error && <p className="error">{error}</p>}

            <div
              className="admin-filter-bar"
              role="group"
              aria-label={t('admin.directoryKind')}
            >
              {KINDS.map((kind) => (
                <button
                  key={kind || 'all'}
                  type="button"
                  className={
                    filter === kind
                      ? 'admin-filter-chip admin-filter-chip-active'
                      : 'admin-filter-chip'
                  }
                  aria-pressed={filter === kind}
                  onClick={() => setFilter(kind)}
                >
                  {kindLabel(kind)}
                </button>
              ))}
            </div>

            <div className="admin-directory-layout">
              <section className="card admin-directory-editor">
                <h2 className="section-title">
                  {editingId
                    ? t('admin.directoryEdit')
                    : t('admin.directoryAdd')}
                </h2>
                <div className="admin-directory-form">
                  <label>
                    {t('admin.directoryKind')}
                    <select
                      value={form.kind}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          kind: e.target.value as SupplyDirectoryKind,
                        }))
                      }
                    >
                      <option value="contractor">
                        {t('admin.directoryKindContractor')}
                      </option>
                      <option value="designer">
                        {t('admin.directoryKindDesigner')}
                      </option>
                      <option value="supplier">
                        {t('admin.directoryKindSupplier')}
                      </option>
                    </select>
                  </label>
                  <label>
                    {t('admin.directoryCompany')}
                    <input
                      value={form.companyName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          companyName: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t('admin.directoryContact')}
                    <input
                      value={form.contactName ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          contactName: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t('admin.directoryEmail')}
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    {t('admin.directoryPhone')}
                    <input
                      value={form.phone ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, phone: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    {t('admin.directoryWebsite')}
                    <input
                      value={form.website ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          website: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                {locationCatalog ? (
                  <ServiceLocationEditor
                    catalog={locationCatalog}
                    value={form.serviceLocations ?? []}
                    onChange={(serviceLocations) =>
                      setForm((prev) => ({ ...prev, serviceLocations }))
                    }
                    disabled={busy}
                    allowEmpty
                    hint={t('admin.directoryLocationsHint')}
                  />
                ) : (
                  <p className="muted">{t('contractor.loadingLocations')}</p>
                )}

                <fieldset className="tag-fieldset">
                  <legend>{t('admin.directoryTradesLegend')}</legend>
                  <p className="muted tag-hint">
                    {t('admin.directoryTradesHint')}
                  </p>
                  <TradeTagPicker
                    tags={specialtyTags}
                    selected={form.tagSlugs ?? []}
                    onChange={(tagSlugs) =>
                      setForm((prev) => ({ ...prev, tagSlugs }))
                    }
                    disabled={busy}
                  />
                </fieldset>

                <label className="admin-directory-notes">
                  {t('admin.directoryNotes')}
                  <textarea
                    rows={3}
                    value={form.notes ?? ''}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </label>

                <div className="tender-actions-block">
                  <button
                    type="button"
                    className="primary"
                    disabled={
                      busy || !form.companyName.trim() || !form.email.trim()
                    }
                    onClick={() => void handleSave()}
                  >
                    {t('admin.directorySave')}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={resetForm}
                    >
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </section>

              <section className="card admin-directory-registry">
                <h2 className="section-title">{t('admin.directoryListTitle')}</h2>
                {list.length === 0 ? (
                  <p className="muted">{t('admin.directoryEmpty')}</p>
                ) : (
                  <ul className="admin-directory-list">
                    {list.map((entry) => (
                      <li key={entry.id} className="admin-directory-card">
                        <div className="admin-directory-card-header">
                          <div>
                            <div className="admin-directory-card-title-row">
                              <strong>{entry.companyName}</strong>
                              <span className="admin-directory-kind-badge">
                                {kindLabel(entry.kind)}
                              </span>
                            </div>
                            <p className="admin-directory-card-contact muted">
                              {[
                                entry.contactName?.trim(),
                                entry.email,
                                entry.phone?.trim(),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <div className="admin-directory-actions">
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy}
                              onClick={() => startEdit(entry)}
                            >
                              {t('admin.directoryEdit')}
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy}
                              onClick={() => void handleDelete(entry.id)}
                            >
                              {t('admin.directoryDelete')}
                            </button>
                          </div>
                        </div>

                        <dl className="admin-directory-meta">
                          {entry.website?.trim() ? (
                            <div>
                              <dt>{t('admin.directoryWebsite')}</dt>
                              <dd>
                                <a
                                  href={
                                    entry.website.startsWith('http')
                                      ? entry.website
                                      : `https://${entry.website}`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {entry.website}
                                </a>
                              </dd>
                            </div>
                          ) : null}
                          <div>
                            <dt>{t('admin.directoryLocationsLabel')}</dt>
                            <dd>{formatLocations(entry.serviceLocations)}</dd>
                          </div>
                          <div>
                            <dt>{t('admin.directoryTradesLabel')}</dt>
                            <dd>
                              {entry.tagSlugs.length === 0 ? (
                                t('admin.directoryTagsAny')
                              ) : (
                                <span className="admin-directory-tag-list">
                                  {entry.tagSlugs.map((slug) => {
                                    const tag = specialtyTags.find(
                                      (item) => item.slug === slug,
                                    );
                                    return (
                                      <span
                                        key={slug}
                                        className="admin-directory-tag-chip"
                                      >
                                        {formatTagLabel(
                                          slug,
                                          tag?.label ?? slug,
                                        )}
                                      </span>
                                    );
                                  })}
                                </span>
                              )}
                            </dd>
                          </div>
                          {entry.notes?.trim() ? (
                            <div>
                              <dt>{t('admin.directoryNotes')}</dt>
                              <dd className="admin-directory-notes-text">
                                {entry.notes}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          void (async () => {
            const session = await refreshSession();
            if (session && isAdmin(session.roles)) {
              await loadList();
            }
          })();
        }}
      />
    </PageShell>
  );
}
