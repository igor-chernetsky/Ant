'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { ProjectTile } from '@/components/ProjectTile';
import { SiteHeader } from '@/components/SiteHeader';
import { TagFilterBar } from '@/components/TagFilterBar';
import {
  fetchPublicProjects,
  fetchPublicTags,
  type PublicProjectCard,
} from '@/lib/public-projects';
import {
  fetchSessionProfile,
  logoutSession,
  type MeResponse,
} from '@/lib/session';

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [projects, setProjects] = useState<PublicProjectCard[]>([]);
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
        const [profile, tags] = await Promise.all([
          fetchSessionProfile(),
          fetchPublicTags(),
        ]);
        setMe(profile);
        setAllTags(tags.map((t) => ({ slug: t.slug, label: t.label })));
      } catch {
        setMe(null);
      } finally {
        setSessionReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    void loadProjects(selectedTags);
  }, [sessionReady, selectedTags, loadProjects]);

  useEffect(() => {
    if (pendingCreate && me) {
      setPendingCreate(false);
      setCreateOpen(true);
    }
  }, [pendingCreate, me]);

  const handleAddProject = () => {
    if (me) {
      setCreateOpen(true);
    } else {
      setPendingCreate(true);
      setLoginOpen(true);
    }
  };

  const handleLogout = async () => {
    await logoutSession();
    setMe(null);
  };

  const handleLoginSuccess = async () => {
    const profile = await fetchSessionProfile();
    setMe(profile);
  };

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
        onAddProject={handleAddProject}
      />

      <main className="content-container main-content">
        <section className="page-hero">
          <h1>Construction projects</h1>
          <p className="page-hero-lead muted">
            Browse renovation and build opportunities. Sign in to publish your
            own project and receive contractor estimates.
          </p>
        </section>

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
              No projects match your filters yet. Try clearing tags or add the
              first project.
            </p>
            <button type="button" className="primary" onClick={handleAddProject}>
              Add project
            </button>
          </section>
        )}

        {!loading && projects.length > 0 && (
          <section className="project-grid" aria-label="Projects">
            {projects.map((project) => (
              <ProjectTile key={project.id} project={project} />
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
      />
    </PageShell>
  );
}
