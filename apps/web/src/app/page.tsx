'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { HomeHero } from '@/components/HomeHero';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { ProjectTile } from '@/components/ProjectTile';
import { useSession } from '@/components/SessionProvider';
import { useTranslation } from '@/components/LocaleProvider';
import { canCreateProject, isContractorUser } from '@/lib/session';
import { SiteHeader } from '@/components/SiteHeader';
import {
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
    services: [],
    propertyOwnership: [],
  });
  const [contractorFilterInitialized, setContractorFilterInitialized] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);

  const loadProjects = useCallback(async (next: HomeProjectFilterState) => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPublicProjects({
        tags: next.tags,
        statuses: next.statuses,
        regionSlug: next.regionSlug || undefined,
        areaSlug: next.areaSlug || undefined,
        services: next.services,
        propertyOwnership: next.propertyOwnership,
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
  }, [sessionReady, filters, loadProjects, locale]);

  useEffect(() => {
    if (!sessionReady) return;

    if (!me) {
      setContractorFilterInitialized(false);
      setFilters({
        tags: [],
        statuses: [],
        regionSlug: '',
        areaSlug: '',
        services: [],
        propertyOwnership: [],
      });
      return;
    }

    if (!isContractorUser(me) || contractorFilterInitialized) {
      return;
    }

    void (async () => {
      try {
        const profile = await fetchContractorProfile();
        if (!profile) return;
        setFilters((current) => ({
          ...current,
          tags: profile.tagSlugs?.length ? profile.tagSlugs : current.tags,
          regionSlug:
            profile.serviceLocations?.[0]?.regionSlug ?? current.regionSlug,
          areaSlug:
            profile.serviceLocations?.[0]?.areaSlug ?? current.areaSlug,
        }));
      } catch {
        // Keep empty filter when profile is unavailable.
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
    if (
      !me ||
      (ownedProjectIds.size === 0 && contractorParticipationByProjectId.size === 0)
    ) {
      return projects;
    }
    const mine: PublicProjectCard[] = [];
    const participating: PublicProjectCard[] = [];
    const others: PublicProjectCard[] = [];
    for (const project of projects) {
      if (ownedProjectIds.has(project.id)) {
        mine.push(project);
      } else if (contractorParticipationByProjectId.has(project.id)) {
        participating.push(project);
      } else {
        others.push(project);
      }
    }
    return [...mine, ...participating, ...others];
  }, [projects, me, ownedProjectIds, contractorParticipationByProjectId]);

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main className="content-container main-content">
        <HomeHero
          signedIn={Boolean(me)}
          canAddProject={canAddProject}
          showContractorPortal={isContractorUser(me)}
          onAddProject={handleAddProject}
          onSignIn={() => setLoginOpen(true)}
        />

        <HomeProjectFilters
          tags={allTags}
          locationCatalog={locationCatalog}
          filters={filters}
          onChange={setFilters}
          resultCount={!loading && !error ? projects.length : undefined}
          showHiddenFilter={canAddProject}
          showCompletedFilter={Boolean(me)}
        />

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

        {!loading && !error && projects.length === 0 && (
          <section className="card empty-state">
            <p className="muted">
              {canAddProject
                ? t('home.emptyNoMatchCanAdd')
                : t('home.emptyNoMatch')}
            </p>
            {canAddProject && (
              <button type="button" className="primary" onClick={handleAddProject}>
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
                <div className="project-tile-media project-tile-add-media" aria-hidden>
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
