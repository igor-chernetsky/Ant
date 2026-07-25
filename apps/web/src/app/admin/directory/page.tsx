'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  createAdminDirectoryEntry,
  deleteAdminDirectoryEntry,
  fetchAdminDirectoryEntries,
  updateAdminDirectoryEntry,
  type SupplyDirectoryEntry,
  type SupplyDirectoryKind,
  type UpsertDirectoryEntryInput,
} from '@/lib/directory';
import { isAdmin } from '@/lib/verification';

const EMPTY_FORM: UpsertDirectoryEntryInput = {
  kind: 'contractor',
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  regionSlug: '',
  notes: '',
  isActive: true,
  sortOrder: 0,
};

const KINDS: Array<SupplyDirectoryKind | ''> = [
  '',
  'contractor',
  'designer',
  'supplier',
];

export default function AdminDirectoryPage() {
  const { t } = useTranslation();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<SupplyDirectoryKind | ''>('');
  const [list, setList] = useState<SupplyDirectoryEntry[]>([]);
  const [form, setForm] = useState<UpsertDirectoryEntryInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadList = useCallback(async () => {
    const items = await fetchAdminDirectoryEntries(filter || undefined);
    setList(items);
  }, [filter]);

  useEffect(() => {
    if (!sessionReady) return;
    setReady(true);
    if (me && isAdmin(me.roles)) {
      void loadList().catch((err: unknown) => {
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
      regionSlug: entry.regionSlug ?? '',
      notes: entry.notes ?? '',
      isActive: entry.isActive,
      sortOrder: entry.sortOrder,
    });
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await updateAdminDirectoryEntry(editingId, form);
      } else {
        await createAdminDirectoryEntry(form);
      }
      resetForm();
      await loadList();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : editingId
            ? t('admin.directoryUpdateFailed')
            : t('admin.directoryCreateFailed'),
      );
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

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />
      <main className="content-container main-content">
        <section className="page-hero">
          <div className="admin-subnav">
            <Link href="/admin/contractors" className="text-link">
              {t('admin.verificationTitle')}
            </Link>
            <span aria-current="page">{t('admin.directoryNav')}</span>
          </div>
          <h1>{t('admin.directoryTitle')}</h1>
          <p className="page-hero-lead muted">{t('admin.directoryLead')}</p>
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

            <section className="card">
              <div className="admin-filter-row">
                {KINDS.map((kind) => (
                  <button
                    key={kind || 'all'}
                    type="button"
                    className={filter === kind ? 'primary' : 'secondary'}
                    onClick={() => setFilter(kind)}
                  >
                    {kindLabel(kind)}
                  </button>
                ))}
              </div>

              {list.length === 0 ? (
                <p className="muted">{t('admin.directoryEmpty')}</p>
              ) : (
                <ul className="admin-directory-list">
                  {list.map((entry) => (
                    <li key={entry.id} className="admin-directory-item">
                      <div>
                        <strong>{entry.companyName}</strong>
                        <p className="muted">
                          {kindLabel(entry.kind)} · {entry.email}
                          {!entry.isActive ? ' · inactive' : ''}
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
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2 className="section-title">
                {editingId ? t('admin.directoryEdit') : t('admin.directoryAdd')}
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
                      setForm((prev) => ({ ...prev, website: e.target.value }))
                    }
                  />
                </label>
                <label>
                  {t('admin.directoryRegion')}
                  <input
                    value={form.regionSlug ?? ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        regionSlug: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  {t('admin.directorySortOrder')}
                  <input
                    type="number"
                    value={form.sortOrder ?? 0}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sortOrder: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.isActive ?? true}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                  {t('admin.directoryActive')}
                </label>
                <label>
                  {t('admin.directoryNotes')}
                  <textarea
                    rows={3}
                    value={form.notes ?? ''}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="tender-actions-block">
                <button
                  type="button"
                  className="primary"
                  disabled={busy || !form.companyName.trim() || !form.email.trim()}
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
                    {t('common.close')}
                  </button>
                )}
              </div>
            </section>
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
