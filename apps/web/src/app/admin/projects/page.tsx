'use client';

import Link from 'next/link';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
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

const PAGE_SIZE = 20;

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

type AppliedFilters = {
  q: string;
  status: string;
  projectType: string;
  hidden: TriFilter;
  clientQ: string;
  createdFrom: string;
  createdTo: string;
  locationRegionSlug: string;
  hasEstimate: TriFilter;
  contractAmountMin: string;
  contractAmountMax: string;
  signedFrom: string;
  signedTo: string;
  sortBy: AdminProjectSortBy;
  sortDir: AdminProjectSortDir;
};

function estimateLabel(item: AdminProjectListItem): string {
  if (!item.estimate) return '—';
  return `${formatThb(item.estimate.minAmount)} – ${formatThb(item.estimate.maxAmount)}`;
}

function isDesignProject(item: AdminProjectListItem): boolean {
  return item.projectType === 'design';
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={
        expanded
          ? 'admin-projects-chevron admin-projects-chevron--open'
          : 'admin-projects-chevron'
      }
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.9 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.3 4.4" />
      <path d="M6.1 6.1C3.7 7.8 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export default function AdminProjectsTablePage() {
  const { t } = useTranslation();
  const {
    formatProjectStatus,
    formatProjectType,
    formatTenderStatus,
  } = useAppFormatters();
  const { me, ready: sessionReady, signOut } = useSession();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
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
  const [contractAmountMin, setContractAmountMin] = useState('');
  const [contractAmountMax, setContractAmountMax] = useState('');
  const [signedFrom, setSignedFrom] = useState('');
  const [signedTo, setSignedTo] = useState('');
  const [sortBy, setSortBy] = useState<AdminProjectSortBy>('createdAt');
  const [sortDir, setSortDir] = useState<AdminProjectSortDir>('desc');

  const [applied, setApplied] = useState<AppliedFilters>({
    q: '',
    status: '',
    projectType: '',
    hidden: '',
    clientQ: '',
    createdFrom: '',
    createdTo: '',
    locationRegionSlug: '',
    hasEstimate: '',
    contractAmountMin: '',
    contractAmountMax: '',
    signedFrom: '',
    signedTo: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
  });

  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadSeqRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const itemsLenRef = useRef(0);

  const fetchPage = useCallback(
    async (pageOffset: number, filters: AppliedFilters) => {
      return fetchAdminProjects({
        q: filters.q || undefined,
        status: filters.status || undefined,
        projectType: filters.projectType || undefined,
        hidden: filters.hidden,
        clientQ: filters.clientQ || undefined,
        createdFrom: filters.createdFrom || undefined,
        createdTo: filters.createdTo || undefined,
        locationRegionSlug: filters.locationRegionSlug || undefined,
        hasEstimate: filters.hasEstimate,
        contractAmountMin: filters.contractAmountMin || undefined,
        contractAmountMax: filters.contractAmountMax || undefined,
        signedFrom: filters.signedFrom || undefined,
        signedTo: filters.signedTo || undefined,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        limit: PAGE_SIZE,
        offset: pageOffset,
      });
    },
    [],
  );

  const load = useCallback(
    async (filters = applied) => {
      const seq = ++loadSeqRef.current;
      setLoading(true);
      setLoadingMore(false);
      loadingMoreRef.current = false;
      setError(null);
      try {
        const page = await fetchPage(0, filters);
        if (seq !== loadSeqRef.current) return;
        setItems(page.items);
        setTotal(page.total);
        setHasMore(page.hasMore);
        hasMoreRef.current = page.hasMore;
        itemsLenRef.current = page.items.length;
      } catch (err: unknown) {
        if (seq !== loadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : t('admin.projectsTableLoadFailed'),
        );
        setItems([]);
        setTotal(0);
        setHasMore(false);
        hasMoreRef.current = false;
        itemsLenRef.current = 0;
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [applied, fetchPage, t],
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);
    const seq = loadSeqRef.current;
    const offset = itemsLenRef.current;
    try {
      const page = await fetchPage(offset, applied);
      if (seq !== loadSeqRef.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const merged = [
          ...prev,
          ...page.items.filter((item) => !seen.has(item.id)),
        ];
        itemsLenRef.current = merged.length;
        return merged;
      });
      setTotal(page.total);
      setHasMore(page.hasMore);
      hasMoreRef.current = page.hasMore;
    } catch (err: unknown) {
      if (seq !== loadSeqRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : t('admin.projectsTableLoadMoreFailed'),
      );
    } finally {
      if (seq === loadSeqRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [applied, fetchPage, loading, t]);

  useEffect(() => {
    if (!sessionReady) return;
    setReady(true);
    if (!(me && isAdmin(me.roles))) return;
    void fetchLocationCatalog()
      .then(setLocationCatalog)
      .catch(() => setLocationCatalog(null));
    void load();
    // Initial admin load only — subsequent loads go through Apply / sort.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, me]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { root: null, rootMargin: '240px 0px', threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, hasMore, loadingMore, items.length, loadMore]);

  const applyFilters = () => {
    const next: AppliedFilters = {
      q: q.trim(),
      status,
      projectType,
      hidden,
      clientQ: clientQ.trim(),
      createdFrom,
      createdTo,
      locationRegionSlug,
      hasEstimate,
      contractAmountMin: contractAmountMin.trim(),
      contractAmountMax: contractAmountMax.trim(),
      signedFrom,
      signedTo,
      sortBy,
      sortDir,
    };
    setApplied(next);
    setExpandedId(null);
    void load(next);
  };

  const toggleSort = (column: AdminProjectSortBy) => {
    const nextDir: AdminProjectSortDir =
      sortBy === column && sortDir === 'desc' ? 'asc' : 'desc';
    setSortBy(column);
    setSortDir(nextDir);
    const next = { ...applied, sortBy: column, sortDir: nextDir };
    setApplied(next);
    setExpandedId(null);
    void load(next);
  };

  const handleHideToggle = async (item: AdminProjectListItem) => {
    setBusy(true);
    setError(null);
    try {
      if (item.isHidden) {
        await adminUnhideProject(item.id);
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, isHidden: false } : row,
          ),
        );
      } else {
        await adminHideProject(item.id);
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, isHidden: true } : row,
          ),
        );
      }
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
    const confirmed = await confirm({
      title: t('admin.projectsTableDeleteTitle'),
      message: t('admin.projectsTableDeleteConfirm', { title: item.title }),
      confirmLabel: t('admin.projectsTableDelete'),
      tone: 'danger',
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await adminDeleteProject(item.id);
      setItems((prev) => {
        const next = prev.filter((row) => row.id !== item.id);
        itemsLenRef.current = next.length;
        return next;
      });
      setTotal((prev) => Math.max(0, prev - 1));
      if (expandedId === item.id) setExpandedId(null);
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
    return t('admin.projectsTableLoaded', {
      count: String(items.length),
      total: String(total),
    });
  }, [items.length, t, total]);

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

  const colCount = 11;

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
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterContractMin')}</span>
              <input
                type="number"
                min={0}
                step="1000"
                inputMode="decimal"
                value={contractAmountMin}
                onChange={(e) => setContractAmountMin(e.target.value)}
                placeholder={t('admin.projectsTableFilterContractMinPh')}
              />
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterContractMax')}</span>
              <input
                type="number"
                min={0}
                step="1000"
                inputMode="decimal"
                value={contractAmountMax}
                onChange={(e) => setContractAmountMax(e.target.value)}
                placeholder={t('admin.projectsTableFilterContractMaxPh')}
              />
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterSignedFrom')}</span>
              <input
                type="date"
                value={signedFrom}
                onChange={(e) => setSignedFrom(e.target.value)}
              />
            </label>
            <label className="admin-projects-field">
              <span>{t('admin.projectsTableFilterSignedTo')}</span>
              <input
                type="date"
                value={signedTo}
                onChange={(e) => setSignedTo(e.target.value)}
              />
            </label>
          </div>
          <div className="admin-projects-filters-actions">
            <button
              type="button"
              className="primary"
              disabled={loading || busy}
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
                <th className="admin-projects-col-expand" aria-label={t('admin.projectsTableExpand')} />
                <th className="admin-projects-col-thumb">
                  {t('admin.projectsTableColThumb')}
                </th>
                <th className="admin-projects-col-title">
                  <button
                    type="button"
                    className="admin-projects-sort"
                    onClick={() => toggleSort('title')}
                  >
                    {t('admin.projectsTableColTitle')}
                    {sortMark('title')}
                  </button>
                </th>
                <th className="admin-projects-col-client">
                  {t('admin.projectsTableColClient')}
                </th>
                <th className="admin-projects-col-track">
                  {t('admin.projectsTableColTrack')}
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
                    onClick={() => toggleSort('contractAmount')}
                  >
                    {t('admin.projectsTableColContractAmount')}
                    {sortMark('contractAmount')}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="admin-projects-sort"
                    onClick={() => toggleSort('signedAt')}
                  >
                    {t('admin.projectsTableColSigned')}
                    {sortMark('signedAt')}
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
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={colCount} className="muted">
                    {t('admin.projectsTableEmpty')}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const expanded = expandedId === item.id;
                  const location = locationCatalog
                    ? formatProjectLocation(locationCatalog, item)
                    : item.locationRegionSlug;
                  const design = isDesignProject(item);
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
                            className="icon-button admin-projects-expand-btn"
                            aria-expanded={expanded}
                            aria-label={
                              expanded
                                ? t('admin.projectsTableCollapse')
                                : t('admin.projectsTableExpand')
                            }
                            onClick={() =>
                              setExpandedId(expanded ? null : item.id)
                            }
                          >
                            <ChevronIcon expanded={expanded} />
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
                        <td>
                          <div className="admin-projects-client-cell">
                            <span>
                              {item.client.displayName?.trim() ||
                                t('common.dash')}
                            </span>
                            {item.client.email ? (
                              <a
                                href={`mailto:${item.client.email}`}
                                className="admin-projects-client-email"
                              >
                                {item.client.email}
                              </a>
                            ) : (
                              <span className="muted">{t('common.dash')}</span>
                            )}
                            <Link
                              href={`/admin/clients?id=${encodeURIComponent(item.client.id)}`}
                              className="admin-projects-client-cabinet muted"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              {t('admin.projectsTableClientCabinet')}
                            </Link>
                          </div>
                        </td>
                        <td>
                          <span
                            className={
                              design
                                ? 'admin-projects-track admin-projects-track--design'
                                : 'admin-projects-track admin-projects-track--construction'
                            }
                          >
                            {design
                              ? t('admin.projectsTableTrackDesign')
                              : t('admin.projectsTableTrackConstruction')}
                          </span>
                        </td>
                        <td>{formatProjectStatus(item.status)}</td>
                        <td>{estimateLabel(item)}</td>
                        <td>
                          {item.contractAmount != null
                            ? formatThb(item.contractAmount)
                            : t('common.dash')}
                        </td>
                        <td>
                          {item.contractFullySignedAt
                            ? formatDateTime(item.contractFullySignedAt)
                            : t('common.dash')}
                        </td>
                        <td>{formatDateTime(item.createdAt)}</td>
                        <td>
                          <div className="admin-projects-actions">
                            <Link
                              href={`/projects/${encodeURIComponent(item.id)}`}
                              className="icon-button admin-projects-action-btn"
                              aria-label={t('admin.projectsTableOpen')}
                              title={t('admin.projectsTableOpen')}
                            >
                              <OpenIcon />
                            </Link>
                            <button
                              type="button"
                              className="icon-button admin-projects-action-btn"
                              disabled={busy}
                              aria-label={
                                item.isHidden
                                  ? t('admin.projectsTableUnhide')
                                  : t('admin.projectsTableHide')
                              }
                              title={
                                item.isHidden
                                  ? t('admin.projectsTableUnhide')
                                  : t('admin.projectsTableHide')
                              }
                              onClick={() => void handleHideToggle(item)}
                            >
                              {item.isHidden ? <EyeIcon /> : <EyeOffIcon />}
                            </button>
                            <button
                              type="button"
                              className="icon-button admin-projects-action-btn admin-projects-action-btn--danger"
                              disabled={busy}
                              aria-label={t('admin.projectsTableDelete')}
                              title={t('admin.projectsTableDelete')}
                              onClick={() => void handleDelete(item)}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="admin-projects-detail-row">
                          <td colSpan={colCount}>
                            <div className="admin-projects-detail">
                              <div>
                                <h4>{t('admin.projectsTableDetailClient')}</h4>
                                <p>
                                  {item.client.displayName?.trim() ||
                                    t('common.dash')}
                                </p>
                                <p className="muted">
                                  {item.client.email ? (
                                    <a href={`mailto:${item.client.email}`}>
                                      {item.client.email}
                                    </a>
                                  ) : (
                                    t('common.dash')
                                  )}
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
                                  {t('admin.projectsTableColContractAmount')}:{' '}
                                  {item.contractAmount != null
                                    ? formatThb(item.contractAmount)
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

        {loading && items.length === 0 ? (
          <p className="muted admin-projects-load-status">
            {t('common.loading')}
          </p>
        ) : null}

        {hasMore ? (
          <div
            ref={loadMoreSentinelRef}
            className="admin-projects-load-more"
            aria-hidden
          />
        ) : null}

        {loadingMore ? (
          <p className="muted admin-projects-load-status">
            {t('admin.projectsTableLoadingMore')}
          </p>
        ) : null}
      </main>
      {confirmDialog}
    </>
  );
}
