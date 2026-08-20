'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  adminHideProject,
  adminUnhideProject,
  fetchAdminProjects,
  type AdminProjectListItem,
  type AdminProjectSortBy,
  type AdminProjectSortDir,
} from '@/lib/admin-projects';
import { adminDeleteProject, formatDateTime } from '@/lib/projects';
import { formatThb } from '@/lib/estimate';
import {
  fetchLocationCatalog,
  formatProjectLocation,
  type LocationCatalog,
} from '@/lib/locations';
import { isAdmin } from '@/lib/verification';

const PAGE_SIZE = 30;

const PROJECT_STATUSES = [
  'draft',
  'intake',
  'ready_for_estimate',
  'estimated',
  'pending',
  'clarification',
  'in_tender',
  'awarded',
  'active',
  'completed',
] as const;

const PROJECT_TYPES = [
  'renovation',
  'new_build',
  'extension',
  'commercial_fitout',
  'repair',
  'modernization_reconstruction',
  'design',
  'other',
] as const;

type TriFilter = '' | 'true' | 'false';

function estimateLabel(item: AdminProjectListItem): string {
  if (!item.estimate) return '—';
  return `${formatThb(item.estimate.minAmount)} – ${formatThb(item.estimate.maxAmount)}`;
}

export default function AdminProjectsTablePage() {
  const { t } = useTranslation();
  const {
    formatProjectStatus,
    formatProjectType,
    formatTenderStatus,
  } = useAppFormatters();
  const { me, ready: sessionReady, signOut } = useSession();

  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [locationCatalog, setLocationCatalog] =
    useState<LocationCatalog | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [projectType, setProjectType] = useState('');
  const [hidden, setHidden] = useState<TriFilter>('');
  const [clientQ, setClientQ] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [locationRegionSlug, setLocationRegionSlug] = useState('');
  const [hasEstimate, setHasEstimate] = useState<TriFilter>('');
  const [sortBy, setSortBy] = useState<AdminProjectSortBy>('createdAt');
  const [sortDir, setSortDir] = useState<AdminProjectSortDir>('desc');

  const [applied, setApplied] = useState({
    q: '',
    status: '',
    projectType: '',
    hidden: '' as TriFilter,
    clientQ: '',
    createdFrom: '',
    createdTo: '',
    locationRegionSlug: '',
    hasEstimate: '' as TriFilter,
    sortBy: 'createdAt' as AdminProjectSortBy,
    sortDir: 'desc' as AdminProjectSortDir,
  });

  const load = useCallback(
    async (pageOffset: number, filters = applied) => {
      setBusy(true);
      setError(null);
      try {
        const page = await fetchAdminProjects({
          q: filters.q || undefined,
          status: filters.status || undefined,
          projectType: filters.projectType || undefined,
          hidden: filters.hidden,
          clientQ: filters.clientQ || undefined,
          createdFrom: filters.createdFrom || undefined,
          createdTo: filters.createdTo || undefined,
          locationRegionSlug: filters.locationRegionSlug || undefined,
          hasEstimate: filters.hasEstimate,
          sortBy: filters.sortBy,
          sortDir: filters.sortDir,
          limit: PAGE_SIZE,
          offset: pageOffset,
        });
        setItems(page.items);
        setTotal(page.total);
        setOffset(page.offset);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : t('admin.projectsTableLoadFailed'),
        );
      } finally {
        setBusy(false);
      }
    },
    [applied, t],
  );

  useEffect(() => {
    if (!sessionReady) return;
    setReady(true);
    if (!(me && isAdmin(me.roles))) return;
    void fetchLocationCatalog()
      .then(setLocationCatalog)
      .catch(() => setLocationCatalog(null));
    void load(0);
    // Initial admin load only — subsequent loads go through Apply / sort / pager.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, me]);

  const applyFilters = () => {
    const next = {
      q: q.trim(),
      status,
      projectType,
      hidden,
      clientQ: clientQ.trim(),
      createdFrom,
      createdTo,
      locationRegionSlug,
      hasEstimate,
      sortBy,
      sortDir,
    };
    setApplied(next);
    setExpandedId(null);
    void load(0, next);
  };

  const toggleSort = (column: AdminProjectSortBy) => {
    const nextDir: AdminProjectSortDir =
      sortBy === column && sortDir === 'desc' ? 'asc' : 'desc';
    setSortBy(column);
    setSortDir(nextDir);
    const next = { ...applied, sortBy: column, sortDir: nextDir };
    setApplied(next);
    setExpandedId(null);
    void load(0, next);
  };

  const handleHideToggle = async (item: AdminProjectListItem) => {
    setBusy(true);
    setError(null);
    try {
      if (item.isHidden) {
        await adminUnhideProject(item.id);
      } else {
        await adminHideProject(item.id);
      }
      await load(offset);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.projectsTableActionFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: AdminProjectListItem) => {
    if (
      !window.confirm(
        t('admin.projectsTableDeleteConfirm', { title: item.title }),
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminDeleteProject(item.id);
      await load(offset);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.projectsTableActionFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const pageLabel = useMemo(() => {
    if (total === 0) return t('admin.projectsTableEmpty');
    const from = offset + 1;
    const to = Math.min(offset + items.length, total);
    return t('admin.projectsTableRange', { from, to, total });
  }, [items.length, offset, t, total]);

  const sortMark = (column: AdminProjectSortBy) => {
    if (sortBy !== column) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  if (!ready) {
    return (
      <>
        <SiteHeader
          me={me}
          onSignIn={() => setLoginOpen(true)}
          onSignOut={signOut}
        />
        <main className="admin-projects-page">
          <p className="muted">{t('common.loading')}</p>
        </main>
      </>
    );
  }

  if (!me) {
    return (
      <>
        <SiteHeader
          me={null}
          onSignIn={() => setLoginOpen(true)}
          onSignOut={signOut}
        />
        <main className="admin-projects-page">
          <p>{t('admin.signInPrompt')}</p>
          <button
            type="button"
            className="primary"
            onClick={() => setLoginOpen(true)}
          >
            {t('header.signIn')}
          </button>
        </main>
        <LoginModal
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSuccess={() => {
            setLoginOpen(false);
          }}
        />
      </>
    );
  }

  if (!isAdmin(me.roles)) {
    return (
      <>
        <SiteHeader me={me} onSignIn={() => setLoginOpen(true)} onSignOut={signOut} />
        <main className="admin-projects-page">
          <p className="form-error">{t('admin.roleRequired')}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader me={me} onSignIn={() => setLoginOpen(true)} onSignOut={signOut} />
      <main className="admin-projects-page">
        <header className="admin-projects-hero">
          <div>
            <h1 className="page-title">{t('admin.projectsTableTitle')}</h1>
            <p className="muted">{t('admin.projectsTableLead')}</p>
          </div>
          <p className="admin-projects-count">{pageLabel}</p>
        </header>

        <section className="admin-projects-filters card">
          <div className="admin-projects-filters-grid">
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterSearch')}</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('admin.projectsTableFilterSearchPh')}
              />
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterClient')}</span>
              <input
                value={clientQ}
                onChange={(e) => setClientQ(e.target.value)}
                placeholder={t('admin.projectsTableFilterClientPh')}
              />
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterStatus')}</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t('admin.filterAll')}</option>
                {PROJECT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {formatProjectStatus(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterType')}</span>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
              >
                <option value="">{t('admin.filterAll')}</option>
                {PROJECT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {formatProjectType(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterHidden')}</span>
              <select
                value={hidden}
                onChange={(e) => setHidden(e.target.value as TriFilter)}
              >
                <option value="">{t('admin.filterAll')}</option>
                <option value="true">{t('admin.projectsTableHiddenYes')}</option>
                <option value="false">{t('admin.projectsTableHiddenNo')}</option>
              </select>
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterEstimate')}</span>
              <select
                value={hasEstimate}
                onChange={(e) => setHasEstimate(e.target.value as TriFilter)}
              >
                <option value="">{t('admin.filterAll')}</option>
                <option value="true">{t('admin.projectsTableHasEstimate')}</option>
                <option value="false">{t('admin.projectsTableNoEstimate')}</option>
              </select>
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterRegion')}</span>
              <select
                value={locationRegionSlug}
                onChange={(e) => setLocationRegionSlug(e.target.value)}
              >
                <option value="">{t('admin.filterAll')}</option>
                {(locationCatalog?.regions ?? []).map((region) => (
                  <option key={region.slug} value={region.slug}>
                    {region.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterFrom')}</span>
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
              />
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterTo')}</span>
              <input
                type="date"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
              />
            </label>
          </div>
          <div className="admin-projects-filters-actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={applyFilters}
            >
              {t('admin.projectsTableApply')}
            </button>
          </div>
        </section>

        {error && <p className="form-error">{error}</p>}

        <div className="admin-projects-table-wrap">
          <table className="admin-projects-table">
            <thead>
              <tr>
                <th className="admin-projects-col-expand" aria-label="Expand" />
                <th className="admin-projects-col-thumb">
                  {t('admin.projectsTableColThumb')}
                </th>
                <th>
                  <button
                    type="button"
                    className="admin-projects-sort"
                    onClick={() => toggleSort('title')}
                  >
                    {t('admin.projectsTableColTitle')}
                    {sortMark('title')}
                  </button>
                </th>
                <th>{t('admin.projectsTableColStatus')}</th>
                <th>
                  <button
                    type="button"
                    className="admin-projects-sort"
                    onClick={() => toggleSort('estimate')}
                  >
                    {t('admin.projectsTableColEstimate')}
                    {sortMark('estimate')}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="admin-projects-sort"
                    onClick={() => toggleSort('createdAt')}
                  >
                    {t('admin.projectsTableColCreated')}
                    {sortMark('createdAt')}
                  </button>
                </th>
                <th className="admin-projects-col-actions">
                  {t('admin.projectsTableColActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !busy ? (
                <tr>
                  <td colSpan={7} className="muted">
                    {t('admin.projectsTableEmpty')}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const expanded = expandedId === item.id;
                  const location = locationCatalog
                    ? formatProjectLocation(locationCatalog, item)
                    : item.locationRegionSlug;
                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={
                          item.isHidden
                            ? 'admin-projects-row admin-projects-row--hidden'
                            : 'admin-projects-row'
                        }
                      >
                        <td>
                          <button
                            type="button"
                            className="secondary admin-projects-expand-btn"
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedId(expanded ? null : item.id)
                            }
                          >
                            {expanded ? '−' : '+'}
                          </button>
                        </td>
                        <td>
                          <div className="admin-projects-thumb">
                            {item.coverImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.coverImageUrl}
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <span className="admin-projects-thumb-ph" />
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="admin-projects-title-cell">
                            <strong>{item.title}</strong>
                            {item.isHidden && (
                              <span className="admin-projects-badge">
                                {t('admin.projectsTableHiddenBadge')}
                              </span>
                            )}
                            <span className="muted">
                              {formatProjectType(item.projectType)}
                            </span>
                          </div>
                        </td>
                        <td>{formatProjectStatus(item.status)}</td>
                        <td>{estimateLabel(item)}</td>
                        <td>{formatDateTime(item.createdAt)}</td>
                        <td>
                          <div className="admin-projects-actions">
                            <Link
                              href={`/projects/${encodeURIComponent(item.id)}`}
                              className="secondary"
                            >
                              {t('admin.projectsTableOpen')}
                            </Link>
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy}
                              onClick={() => void handleHideToggle(item)}
                            >
                              {item.isHidden
                                ? t('admin.projectsTableUnhide')
                                : t('admin.projectsTableHide')}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              disabled={busy}
                              onClick={() => void handleDelete(item)}
                            >
                              {t('admin.projectsTableDelete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="admin-projects-detail-row">
                          <td colSpan={7}>
                            <div className="admin-projects-detail">
                              <div>
                                <h4>{t('admin.projectsTableDetailClient')}</h4>
                                <p>
                                  {item.client.displayName?.trim() ||
                                    t('common.dash')}
                                </p>
                                <p className="muted">
                                  {item.client.email || t('common.dash')}
                                </p>
                              </div>
                              <div>
                                <h4>{t('admin.projectsTableDetailLocation')}</h4>
                                <p>{location}</p>
                                {item.locationNote ? (
                                  <p className="muted">{item.locationNote}</p>
                                ) : null}
                              </div>
                              <div>
                                <h4>
                                  {t('admin.projectsTableDetailContractor')}
                                </h4>
                                <p>
                                  {item.awardedContractorName ||
                                    t('common.dash')}
                                </p>
                              </div>
                              <div>
                                <h4>{t('admin.projectsTableDetailDates')}</h4>
                                <p>
                                  {t('admin.projectsTableCreated')}:{' '}
                                  {formatDateTime(item.createdAt)}
                                </p>
                                <p>
                                  {t('admin.projectsTableSigned')}:{' '}
                                  {item.contractFullySignedAt
                                    ? formatDateTime(item.contractFullySignedAt)
                                    : t('common.dash')}
                                </p>
                                <p>
                                  {t('admin.projectsTableCompleted')}:{' '}
                                  {item.completedAt
                                    ? formatDateTime(item.completedAt)
                                    : t('common.dash')}
                                </p>
                              </div>
                              <div>
                                <h4>
                                  {t('admin.projectsTableDetailEstimate')}
                                </h4>
                                {item.estimate ? (
                                  <>
                                    <p>{estimateLabel(item)}</p>
                                    <p className="muted">
                                      {t('admin.projectsTableMid')}:{' '}
                                      {formatThb(item.estimate.midAmount)} ·{' '}
                                      {t('admin.projectsTableConfidence')}:{' '}
                                      {Math.round(
                                        item.estimate.confidence * 100,
                                      )}
                                      %
                                    </p>
                                  </>
                                ) : (
                                  <p>{t('common.dash')}</p>
                                )}
                              </div>
                              <div>
                                <h4>{t('admin.projectsTableDetailTender')}</h4>
                                <p>
                                  {item.tenderStatus
                                    ? formatTenderStatus(item.tenderStatus)
                                    : t('common.dash')}
                                </p>
                                <p className="muted">
                                  {t('admin.projectsTableBids', {
                                    count: item.bidCount,
                                  })}
                                </p>
                              </div>
                              <div>
                                <h4>{t('admin.projectsTableDetailFee')}</h4>
                                <p>
                                  {item.platformFeePaid
                                    ? t('admin.projectsTableFeePaid')
                                    : t('admin.projectsTableFeeUnpaid')}
                                </p>
                              </div>
                              <div className="admin-projects-detail-desc">
                                <h4>
                                  {t('admin.projectsTableDetailDescription')}
                                </h4>
                                <p>
                                  {item.description?.trim() || t('common.dash')}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-projects-pager">
          <button
            type="button"
            className="secondary"
            disabled={busy || offset <= 0}
            onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
          >
            {t('admin.projectsTablePrev')}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || offset + items.length >= total}
            onClick={() => void load(offset + PAGE_SIZE)}
          >
            {t('admin.projectsTableNext')}
          </button>
        </div>
      </main>
    </>
  );
}
