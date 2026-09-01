'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { HelpTip } from '@/components/help/HelpTip';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { ProjectTile } from '@/components/ProjectTile';
import { HomeAdCard } from '@/components/HomeAdCard';
import { useSession } from '@/components/SessionProvider';
import { useTranslation } from '@/components/LocaleProvider';
import { canCreateProject, isSupplySideUser } from '@/lib/session';
import { SiteHeader } from '@/components/SiteHeader';
import {
  countHomeActiveFilters,
  HomeProjectFilters,
  type HomeProjectFilterState,
} from '@/components/HomeProjectFilters';
import {
  fetchContractorApplications,
  fetchContractorProfile,
  type ContractorApplicationItem,
} from '@/lib/tendering';
import {
  fetchProjects,
  type Project,
} from '@/lib/projects';
import {
  fetchPublicProjects,
  fetchPublicTags,
  PUBLIC_PROJECTS_PAGE_SIZE,
  type PublicProjectCard,
  type PublicProjectListPage,
} from '@/lib/public-projects';
import {
  fetchLocationCatalog,
  type LocationCatalog,
} from '@/lib/locations';
import { canOpenProjectDetail } from '@/lib/project-open-access';
import { HELP_TIP_IDS } from '@/lib/help-tips';
import { AntSpinner } from '@/components/AntSpinner';
import { SupplyVerificationBanner } from '@/components/SupplyVerificationBanner';
import {
  adInsertIndex,
  fetchPublicHomeAds,
  type PublicHomeAdSlide,
} from '@/lib/home-ads';

const EMPTY_HOME_FILTERS: HomeProjectFilterState = {
  tags: [],
  statuses: [],
  regionSlug: '',
  areaSlug: '',
  projectTrack: null,
  propertyTypes: [],
  ownershipScope: 'all',
  onlyAvailable: false,
};

export interface HomePageClientProps {
  initialPublicProjects?: PublicProjectListPage | null;
}

export function HomePageClient({
  initialPublicProjects = null,
}: HomePageClientProps) {
  const hasInitialProjects = initialPublicProjects != null;
  const skipInitialLoadRef = useRef(hasInitialProjects);
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [projects, setProjects] = useState<PublicProjectCard[]>(
    initialPublicProjects?.items ?? [],
  );
  const [totalCount, setTotalCount] = useState(initialPublicProjects?.total ?? 0);
  const [hasMore, setHasMore] = useState(initialPublicProjects?.hasMore ?? false);
  const [ownedProjectIds, setOwnedProjectIds] = useState<Set<string>>(new Set());
  const [contractorApplications, setContractorApplications] = useState<
    ContractorApplicationItem[]
  >([]);
  const [allTags, setAllTags] = useState<Array<{ slug: string; label: string }>>(
    [],
  );
  const [locationCatalog, setLocationCatalog] =
    useState<LocationCatalog | null>(null);
  const [filters, setFilters] = useState<HomeProjectFilterState>(EMPTY_HOME_FILTERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [contractorTagSlugs, setContractorTagSlugs] = useState<string[]>([]);
  const [contractorFilterInitialized, setContractorFilterInitialized] =
    useState(false);
  const [loading, setLoading] = useState(!hasInitialProjects);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [adSlides, setAdSlides] = useState<PublicHomeAdSlide[]>([]);
  const [gridColumns, setGridColumns] = useState(1);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const lastResultsScrollTop = useRef(0);
  const loadSeqRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(initialPublicProjects?.hasMore ?? false);
  const projectsLenRef = useRef(initialPublicProjects?.items.length ?? 0);
  const createQueryHandled = useRef(false);

  const buildListFilters = useCallback(
    (next: HomeProjectFilterState, offset: number) => ({
      tags: next.tags,
      statuses: next.statuses,
      regionSlug: next.regionSlug || undefined,
      areaSlug: next.areaSlug || undefined,
      projectTrack: next.projectTrack,
      propertyTypes: next.propertyTypes,
      limit: PUBLIC_PROJECTS_PAGE_SIZE,
      offset,
    }),
    [],
  );

  const loadProjects = useCallback(
    async (next: HomeProjectFilterState) => {
      const seq = ++loadSeqRef.current;
      setLoading(true);
      setLoadingMore(false);
      loadingMoreRef.current = false;
      setError(null);
      try {
        const page = await fetchPublicProjects(buildListFilters(next, 0));
        if (seq !== loadSeqRef.current) return;
        setProjects(page.items);
        setTotalCount(page.total);
        setHasMore(page.hasMore);
        hasMoreRef.current = page.hasMore;
        projectsLenRef.current = page.items.length;
      } catch (err: unknown) {
        if (seq !== loadSeqRef.current) return;
        setError(err instanceof Error ? err.message : t('home.loadFailed'));
        setProjects([]);
        setTotalCount(0);
        setHasMore(false);
        hasMoreRef.current = false;
        projectsLenRef.current = 0;
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [buildListFilters, t],
  );

  const loadMoreProjects = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);
    const seq = loadSeqRef.current;
    const offset = projectsLenRef.current;
    try {
      const page = await fetchPublicProjects(buildListFilters(filters, offset));
      if (seq !== loadSeqRef.current) return;
      setProjects((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const merged = [
          ...prev,
          ...page.items.filter((item) => !seen.has(item.id)),
        ];
        projectsLenRef.current = merged.length;
        return merged;
      });
      setTotalCount(page.total);
      setHasMore(page.hasMore);
      hasMoreRef.current = page.hasMore;
    } catch (err: unknown) {
      if (seq !== loadSeqRef.current) return;
      setError(
        err instanceof Error ? err.message : t('home.loadMoreFailed'),
      );
    } finally {
      if (seq === loadSeqRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [buildListFilters, filters, loading, t]);

  useEffect(() => {
    void (async () => {
      try {
        const [tags, locations] = await Promise.all([
          fetchPublicTags(),
          fetchLocationCatalog(),
        ]);
        setAllTags(
          tags
            .filter((tag) => tag.groupSlug === 'trade' || !tag.groupSlug)
            .map((tag) => ({ slug: tag.slug, label: tag.label })),
        );
        setLocationCatalog(locations);
      } catch {
        setAllTags([]);
        setLocationCatalog(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      if (!me) return;
    }
    void loadProjects(filters);
  }, [sessionReady, filters, loadProjects, locale, me?.id, me?.roles, me]);

  useEffect(() => {
    if (!sessionReady) return;

    if (!me) {
      setContractorFilterInitialized(false);
      setContractorTagSlugs([]);
      setFilters({ ...EMPTY_HOME_FILTERS });
      return;
    }

    if (!isSupplySideUser(me)) {
      setContractorTagSlugs([]);
      return;
    }

    if (contractorFilterInitialized) {
      return;
    }

    void (async () => {
      try {
        const profile = await fetchContractorProfile();
        // Default: All trades + All regions. Profile tags only power the "My trades" preset.
        setContractorTagSlugs(profile?.tagSlugs ?? []);
      } catch {
        setContractorTagSlugs([]);
      } finally {
        setContractorFilterInitialized(true);
      }
    })();
  }, [sessionReady, me, contractorFilterInitialized]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!me) {
      setOwnedProjectIds(new Set());
      setContractorApplications([]);
      return;
    }

    void (async () => {
      try {
        const tasks: Promise<void>[] = [];
        if (canCreateProject(me)) {
          tasks.push(
            fetchProjects().then((mine) => {
              setOwnedProjectIds(new Set(mine.map((project: Project) => project.id)));
            }),
          );
        } else {
          setOwnedProjectIds(new Set());
        }
        if (isSupplySideUser(me)) {
          tasks.push(
            fetchContractorApplications().then((apps) => {
              setContractorApplications(apps);
            }),
          );
        } else {
          setContractorApplications([]);
        }
        await Promise.all(tasks);
      } catch {
        setOwnedProjectIds(new Set());
        setContractorApplications([]);
      }
    })();
  }, [sessionReady, me]);

  useEffect(() => {
    if (pendingCreate && me) {
      setPendingCreate(false);
      setCreateOpen(true);
    }
  }, [pendingCreate, me]);

  useEffect(() => {
    if (!sessionReady || createQueryHandled.current) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') !== '1') return;

    createQueryHandled.current = true;
    router.replace('/', { scroll: false });

    if (me && !canCreateProject(me)) return;
    if (me) {
      setCreateOpen(true);
    } else {
      setPendingCreate(true);
      setLoginOpen(true);
    }
  }, [sessionReady, me, router]);

  useEffect(() => {
    if (!me) {
      setCreateOpen(false);
      setLoginOpen(false);
      setPendingCreate(false);
    }
  }, [me]);

  useEffect(() => {
    if (!filtersOpen) return;

    const mobileMq = window.matchMedia('(max-width: 899px)');
    let locked = false;
    let scrollY = 0;

    const lock = () => {
      if (locked) return;
      locked = true;
      scrollY = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    };

    const unlock = () => {
      if (!locked) return;
      locked = false;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };

    const syncBodyLock = () => {
      if (mobileMq.matches) lock();
      else unlock();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFiltersOpen(false);
      }
    };

    syncBodyLock();
    mobileMq.addEventListener('change', syncBodyLock);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      mobileMq.removeEventListener('change', syncBodyLock);
      window.removeEventListener('keydown', onKeyDown);
      unlock();
    };
  }, [filtersOpen]);

  useEffect(() => {
    const el = resultsRef.current;
    if (!el) return;

    const onScroll = () => {
      const y = el.scrollTop;
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      const delta = y - lastResultsScrollTop.current;
      const nearBottom = max > 0 && y >= max - 48;

      if (nearBottom) {
        setFooterVisible(true);
      } else if (delta > 6) {
        setFooterVisible(true);
      } else if (delta < -6) {
        setFooterVisible(false);
      }

      lastResultsScrollTop.current = y;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreProjects();
        }
      },
      // Viewport root works for both desktop (.home-results scroll) and mobile (page scroll).
      { root: null, rootMargin: '320px 0px', threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, hasMore, loadingMore, projects.length, loadMoreProjects]);

  useEffect(() => {
    void fetchPublicHomeAds()
      .then(setAdSlides)
      .catch(() => setAdSlides([]));
  }, []);

  const handleAddProject = () => {
    if (me && !canCreateProject(me)) return;
    if (me) {
      setCreateOpen(true);
    } else {
      setPendingCreate(true);
      setLoginOpen(true);
    }
  };

  const handleLogout = () => {
    void signOut();
  };

  const handleLoginSuccess = async () => {
    await refreshSession();
  };

  const canAddProject = canCreateProject(me);

  const contractorParticipationByProjectId = useMemo(() => {
    const map = new Map<string, ContractorApplicationItem>();
    for (const app of contractorApplications) {
      map.set(app.projectId, app);
    }
    return map;
  }, [contractorApplications]);

  const sortedProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const ownershipRank = (project: PublicProjectCard): number => {
      if (me && ownedProjectIds.has(project.id)) return 0;
      if (me && contractorParticipationByProjectId.has(project.id)) return 1;
      return 2;
    };

    const matchRank = (project: PublicProjectCard): number | null => {
      if (!query) return 0;
      if (project.title.toLowerCase().includes(query)) return 0;
      if ((project.description ?? '').toLowerCase().includes(query)) return 1;
      return null;
    };

    const ranked = projects
      .map((project) => {
        if (
          filters.ownershipScope === 'mine' &&
          me &&
          !ownedProjectIds.has(project.id)
        ) {
          return null;
        }
        if (filters.onlyAvailable) {
          const participation =
            contractorParticipationByProjectId.get(project.id) ?? null;
          const isAwardedContractor =
            participation?.bidStatus === 'selected' ||
            Boolean(participation?.isActiveProject);
          const canOpen =
            canOpenProjectDetail(project.status, {
              me,
              isOwned: Boolean(me && ownedProjectIds.has(project.id)),
              isAwardedContractor,
              projectType: project.projectType,
            }) || project.canOpenDetail === true;
          if (!canOpen) return null;
        }
        const match = matchRank(project);
        if (match == null) return null;
        return { project, match, ownership: ownershipRank(project) };
      })
      .filter(
        (
          entry,
        ): entry is {
          project: PublicProjectCard;
          match: number;
          ownership: number;
        } => entry != null,
      );

    ranked.sort((a, b) => {
      if (a.match !== b.match) return a.match - b.match;
      if (a.ownership !== b.ownership) return a.ownership - b.ownership;
      return 0;
    });

    return ranked.map((entry) => entry.project);
  }, [
    projects,
    searchQuery,
    filters.ownershipScope,
    filters.onlyAvailable,
    me,
    ownedProjectIds,
    contractorParticipationByProjectId,
  ]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const measure = () => {
      const template = getComputedStyle(grid).gridTemplateColumns;
      const count = template.split(' ').filter(Boolean).length;
      setGridColumns(Math.max(1, count));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [loading, sortedProjects.length, adSlides.length, canAddProject]);

  const activeFilterCount = countHomeActiveFilters(filters, searchQuery);
  const displayCount =
    searchQuery.trim() ||
    filters.ownershipScope === 'mine' ||
    filters.onlyAvailable
      ? sortedProjects.length
      : totalCount;

  return (
    <PageShell
      className={`page-shell--home${footerVisible ? ' page-shell--home-footer-visible' : ''}`}
    >
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
        onCreateProject={handleAddProject}
      />

      <SupplyVerificationBanner />

      <main className="home-main main-content">
        <div className={`home-layout${filtersOpen ? ' home-layout--filters-open' : ''}`}>
          <div className="home-toolbar">
            <button
              type="button"
              className="home-filters-toggle"
              aria-expanded={filtersOpen}
              aria-controls="home-filters-sidebar"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? t('filters.closeFilters') : t('filters.openFilters')}
              {activeFilterCount > 0 && (
                <span className="home-filters-toggle-badge">{activeFilterCount}</span>
              )}
            </button>
            {!loading && !error && (
              <span className="home-toolbar-count muted">
                {displayCount}{' '}
                {displayCount === 1
                  ? t('filters.project')
                  : t('filters.projects')}
              </span>
            )}
          </div>

          {filtersOpen && (
            <button
              type="button"
              className="home-filters-backdrop"
              aria-label={t('filters.closeFilters')}
              onClick={() => setFiltersOpen(false)}
            />
          )}

          <aside
            id="home-filters-sidebar"
            className={`home-sidebar${filtersOpen ? ' home-sidebar--open' : ''}`}
          >
            <div className="home-sidebar-mobile-header">
              <h2 className="home-sidebar-mobile-title">{t('filters.browseProjects')}</h2>
              <button
                type="button"
                className="home-sidebar-close"
                aria-label={t('filters.closeFilters')}
                onClick={() => setFiltersOpen(false)}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <HomeProjectFilters
              tags={allTags}
              locationCatalog={locationCatalog}
              filters={filters}
              onChange={setFilters}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              resultCount={!loading && !error ? displayCount : undefined}
              showHiddenFilter={canAddProject}
              showCompletedFilter={Boolean(me)}
              showClientWorkspaceFilters={canAddProject}
              showOnlyAvailableToggle={isSupplySideUser(me)}
              contractorTagSlugs={
                isSupplySideUser(me) ? contractorTagSlugs : undefined
              }
            />
          </aside>

          <div className="home-results" ref={resultsRef}>
            {loading && (
              <div className="home-loading home-loading--initial" role="status">
                <AntSpinner size="lg" label={t('home.loadingProjects')} />
                <span className="muted home-loading-label">
                  {t('home.loadingProjects')}
                </span>
              </div>
            )}

            {error && !loadingMore && (
              <section className="card error">
                <p>{error}</p>
              </section>
            )}

            {!loading && !error && sortedProjects.length === 0 && (
              <section className="card empty-state">
                {canAddProject && (
                  <HelpTip
                    tipId={HELP_TIP_IDS.homeEmpty}
                    title={t('help.tipHomeEmptyTitle')}
                    body={t('help.tipHomeEmptyBody')}
                    learnMoreHref="/help#client-first-project"
                  />
                )}
                <p className="muted">
                  {canAddProject
                    ? t('home.emptyNoMatchCanAdd')
                    : t('home.emptyNoMatch')}
                </p>
                {canAddProject && (
                  <button
                    type="button"
                    className="primary"
                    onClick={handleAddProject}
                  >
                    {t('home.addProject')}
                  </button>
                )}
              </section>
            )}

            {!loading && sortedProjects.length > 0 && (
              <>
                <section
                  ref={gridRef}
                  className="project-grid"
                  aria-label={t('home.projectsAria')}
                >
                  {(() => {
                    const tiles = [
                      ...(canAddProject
                        ? [
                            <button
                              key="add-project"
                              type="button"
                              className="project-tile project-tile-add"
                              onClick={handleAddProject}
                            >
                              <div className="project-tile-add-inner">
                                <span
                                  className="project-tile-add-icon-wrap"
                                  aria-hidden
                                >
                                  <span className="project-tile-add-icon">+</span>
                                </span>
                                <div className="project-tile-add-copy">
                                  <h3 className="project-tile-title">
                                    {t('home.addProject')}
                                  </h3>
                                  <p className="project-tile-add-lead">
                                    {t('home.addProjectDescription')}
                                  </p>
                                </div>
                                <span className="project-tile-add-action">
                                  {t('home.addProjectAction')}
                                </span>
                              </div>
                            </button>,
                          ]
                        : []),
                      ...sortedProjects.map((project) => (
                        <ProjectTile
                          key={project.id}
                          project={project}
                          isOwned={ownedProjectIds.has(project.id)}
                          contractorParticipation={
                            contractorParticipationByProjectId.get(project.id) ??
                            null
                          }
                        />
                      )),
                    ];
                    if (adSlides.length > 0) {
                      const index = Math.min(
                        adInsertIndex(gridColumns),
                        tiles.length,
                      );
                      tiles.splice(
                        index,
                        0,
                        <HomeAdCard key="home-ad" slides={adSlides} />,
                      );
                    }
                    return tiles;
                  })()}
                </section>
                <div
                  ref={loadMoreSentinelRef}
                  className="home-load-more"
                  aria-hidden={!loadingMore}
                >
                  {loadingMore && (
                    <div className="home-loading home-loading--more" role="status">
                      <AntSpinner
                        size="md"
                        label={t('home.loadingMoreProjects')}
                      />
                      <span className="muted home-loading-label">
                        {t('home.loadingMoreProjects')}
                      </span>
                    </div>
                  )}
                  {error && loadingMore === false && hasMore && (
                    <p className="form-error home-load-more-label">{error}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          setPendingCreate(false);
        }}
        onSuccess={handleLoginSuccess}
      />

      <CreateProjectModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => router.push(`/projects/${id}`)}
        onSessionExpired={() => {
          setCreateOpen(false);
          setLoginOpen(true);
        }}
      />
    </PageShell>
  );
}
