'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { HelpTip } from '@/components/help/HelpTip';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { ProjectTile } from '@/components/ProjectTile';
import { useSession } from '@/components/SessionProvider';
import { useTranslation } from '@/components/LocaleProvider';
import { canCreateProject, isContractorUser } from '@/lib/session';
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
  type PublicProjectCard,
} from '@/lib/public-projects';
import {
  fetchLocationCatalog,
  type LocationCatalog,
} from '@/lib/locations';
import { HELP_TIP_IDS } from '@/lib/help-tips';

export default function HomePage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [projects, setProjects] = useState<PublicProjectCard[]>([]);
  const [ownedProjectIds, setOwnedProjectIds] = useState<Set<string>>(new Set());
  const [contractorApplications, setContractorApplications] = useState<
    ContractorApplicationItem[]
  >([]);
  const [allTags, setAllTags] = useState<Array<{ slug: string; label: string }>>(
    [],
  );
  const [locationCatalog, setLocationCatalog] =
    useState<LocationCatalog | null>(null);
  const [filters, setFilters] = useState<HomeProjectFilterState>({
    tags: [],
    statuses: [],
    regionSlug: '',
    areaSlug: '',
    projectTrack: null,
    propertyTypes: [],
    ownershipScope: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [contractorTagSlugs, setContractorTagSlugs] = useState<string[]>([]);
  const [contractorFilterInitialized, setContractorFilterInitialized] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadProjects = useCallback(async (next: HomeProjectFilterState) => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPublicProjects({
        tags: next.tags,
        statuses: next.statuses,
        regionSlug: next.regionSlug || undefined,
        areaSlug: next.areaSlug || undefined,
        projectTrack: next.projectTrack,
        propertyTypes: next.propertyTypes,
      });
      setProjects(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('home.loadFailed'));
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

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
    void loadProjects(filters);
  }, [sessionReady, filters, loadProjects, locale, me?.id, me?.roles]);

  useEffect(() => {
    if (!sessionReady) return;

    if (!me) {
      setContractorFilterInitialized(false);
      setContractorTagSlugs([]);
      setFilters({
        tags: [],
        statuses: [],
        regionSlug: '',
        areaSlug: '',
        projectTrack: null,
        propertyTypes: [],
        ownershipScope: 'all',
      });
      return;
    }

    if (!isContractorUser(me)) {
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
        if (isContractorUser(me)) {
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
    if (!me) {
      setCreateOpen(false);
      setLoginOpen(false);
      setPendingCreate(false);
    }
  }, [me]);

  useEffect(() => {
    if (!filtersOpen) return;

    const syncBodyLock = () => {
      const mobile = window.matchMedia('(max-width: 899px)').matches;
      document.body.style.overflow = mobile ? 'hidden' : '';
    };

    syncBodyLock();
    window.addEventListener('resize', syncBodyLock);
    return () => {
      window.removeEventListener('resize', syncBodyLock);
      document.body.style.overflow = '';
    };
  }, [filtersOpen]);

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
    me,
    ownedProjectIds,
    contractorParticipationByProjectId,
  ]);

  const activeFilterCount = countHomeActiveFilters(filters, searchQuery);

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

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
                {sortedProjects.length}{' '}
                {sortedProjects.length === 1
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
                onClick={() => setFiltersOpen(false)}
              >
                {t('filters.closeFilters')}
              </button>
            </div>
            <HomeProjectFilters
              tags={allTags}
              locationCatalog={locationCatalog}
              filters={filters}
              onChange={setFilters}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              resultCount={!loading && !error ? sortedProjects.length : undefined}
              showHiddenFilter={canAddProject}
              showCompletedFilter={Boolean(me)}
              showClientWorkspaceFilters={canAddProject}
              contractorTagSlugs={
                isContractorUser(me) ? contractorTagSlugs : undefined
              }
            />
          </aside>

          <div className="home-results">
            {loading && (
              <section className="card">
                <p className="muted">{t('home.loadingProjects')}</p>
              </section>
            )}

            {error && (
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
              <section className="project-grid" aria-label={t('home.projectsAria')}>
                {canAddProject && (
                  <button
                    type="button"
                    className="project-tile project-tile-add"
                    onClick={handleAddProject}
                  >
                    <div
                      className="project-tile-media project-tile-add-media"
                      aria-hidden
                    >
                      <span className="project-tile-add-icon">+</span>
                    </div>
                    <div className="project-tile-body">
                      <h3 className="project-tile-title">{t('home.addProject')}</h3>
                      <p className="project-tile-description">
                        {t('home.addProjectDescription')}
                      </p>
                    </div>
                  </button>
                )}
                {sortedProjects.map((project) => (
                  <ProjectTile
                    key={project.id}
                    project={project}
                    isOwned={ownedProjectIds.has(project.id)}
                    contractorParticipation={
                      contractorParticipationByProjectId.get(project.id) ?? null
                    }
                  />
                ))}
              </section>
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
