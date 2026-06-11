'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { HomeHero } from '@/components/HomeHero';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { ProjectTile } from '@/components/ProjectTile';
import { useSession } from '@/components/SessionProvider';
import { canCreateProject, isContractorUser } from '@/lib/session';
import { SiteHeader } from '@/components/SiteHeader';
import {
  fetchContractorInvitations,
  type ContractorInvitationItem,
} from '@/lib/tendering';
import { TagFilterBar } from '@/components/TagFilterBar';
import {
  fetchProjects,
  type Project,
} from '@/lib/projects';
import {
  fetchPublicProjects,
  fetchPublicTags,
  type PublicProjectCard,
} from '@/lib/public-projects';

export default function HomePage() {
  const router = useRouter();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [projects, setProjects] = useState<PublicProjectCard[]>([]);
  const [ownedProjectIds, setOwnedProjectIds] = useState<Set<string>>(new Set());
  const [contractorInvitations, setContractorInvitations] = useState<
    ContractorInvitationItem[]
  >([]);
  const [allTags, setAllTags] = useState<Array<{ slug: string; label: string }>>(
    [],
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);

  const loadProjects = useCallback(async (tagSlugs: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPublicProjects(tagSlugs);
      setProjects(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const tags = await fetchPublicTags();
        setAllTags(tags.map((t) => ({ slug: t.slug, label: t.label })));
      } catch {
        setAllTags([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    void loadProjects(selectedTags);
  }, [sessionReady, selectedTags, loadProjects]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!me) {
      setOwnedProjectIds(new Set());
      setContractorInvitations([]);
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
            fetchContractorInvitations().then((invs) => {
              setContractorInvitations(invs);
            }),
          );
        } else {
          setContractorInvitations([]);
        }
        await Promise.all(tasks);
      } catch {
        setOwnedProjectIds(new Set());
        setContractorInvitations([]);
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
    const map = new Map<string, ContractorInvitationItem>();
    for (const inv of contractorInvitations) {
      map.set(inv.projectId, inv);
    }
    return map;
  }, [contractorInvitations]);

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

        <TagFilterBar
          tags={allTags}
          selected={selectedTags}
          onChange={setSelectedTags}
        />

        {loading && (
          <section className="card">
            <p className="muted">Loading projects…</p>
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
                ? 'No projects match your filters yet. Try clearing tags or add the first project.'
                : 'No projects match your filters yet.'}
            </p>
            {canAddProject && (
              <button type="button" className="primary" onClick={handleAddProject}>
                Add project
              </button>
            )}
          </section>
        )}

        {!loading && sortedProjects.length > 0 && (
          <section className="project-grid" aria-label="Projects">
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
                  <h3 className="project-tile-title">Add project</h3>
                  <p className="project-tile-description">
                    Publish a new project to receive contractor bids.
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
