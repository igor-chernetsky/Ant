'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { SiteHeader } from '@/components/SiteHeader';
import {
  createProject,
  fetchProjects,
  formatProjectStatus,
  type Project,
} from '@/lib/projects';
import {
  fetchSessionProfile,
  logoutSession,
  type MeResponse,
} from '@/lib/session';

type AuthState = 'loading' | 'guest' | 'authenticated';

export default function ProjectsPage() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    const list = await fetchProjects();
    setProjects(list);
  }, []);

  const refreshSession = useCallback(async () => {
    setError(null);
    const profile = await fetchSessionProfile();
    if (profile) {
      setMe(profile);
      setAuthState('authenticated');
      await loadProjects();
    } else {
      setMe(null);
      setAuthState('guest');
      setProjects([]);
    }
  }, [loadProjects]);

  useEffect(() => {
    refreshSession().catch((err: unknown) => {
      if (err instanceof Error && err.message === 'NOT_AUTHENTICATED') {
        setAuthState('guest');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load session');
      setAuthState('guest');
    });
  }, [refreshSession]);

  const handleLogout = async () => {
    await logoutSession();
    setMe(null);
    setProjects([]);
    setAuthState('guest');
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await createProject({
        title,
        description: description.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      await loadProjects();
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NOT_AUTHENTICATED') {
        setLoginOpen(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create project');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main>
        <section className="hero card">
          <h1>My projects</h1>
          <p className="muted">
            Create and track construction or renovation projects.
          </p>
        </section>

        {authState === 'guest' && (
          <section className="card cta">
            <p>Sign in to view and create your projects.</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              Sign in
            </button>
          </section>
        )}

        {authState === 'loading' && (
          <section className="card">
            <p className="muted">Loading…</p>
          </section>
        )}

        {authState === 'authenticated' && (
          <>
            <section className="card">
              <h2 className="section-title">New project</h2>
              <form className="modal-form" onSubmit={handleCreate}>
                <label>
                  Title
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Kitchen renovation"
                    required
                    minLength={3}
                  />
                </label>
                <label>
                  Description (optional)
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Brief scope or goals"
                    rows={3}
                  />
                </label>
                <button
                  type="submit"
                  className="primary"
                  disabled={creating || title.trim().length < 3}
                >
                  {creating ? 'Creating…' : 'Create project'}
                </button>
              </form>
            </section>

            <section className="card">
              <h2 className="section-title">
                Projects ({projects.length})
              </h2>
              {projects.length === 0 ? (
                <p className="muted">No projects yet. Create your first one above.</p>
              ) : (
                <ul className="project-list">
                  {projects.map((project) => (
                    <li key={project.id} className="project-item">
                      <div>
                        <strong>{project.title}</strong>
                        {project.description && (
                          <p className="project-description">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <div className="project-meta">
                        <span className="status-pill">
                          {formatProjectStatus(project.status)}
                        </span>
                        <span className="muted">
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {error && (
          <section className="card error">
            <pre>{error}</pre>
          </section>
        )}
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={refreshSession}
      />
    </>
  );
}
