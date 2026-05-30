'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { SiteHeader } from '@/components/SiteHeader';
import {
  createProject,
  fetchProjects,
  formatProjectStatus,
  formatProjectType,
  PROJECT_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  type Project,
  type ProjectType,
  type PropertyType,
} from '@/lib/projects';
import {
  fetchSessionProfile,
  logoutSession,
  type MeResponse,
} from '@/lib/session';

type AuthState = 'loading' | 'guest' | 'authenticated';

export default function ProjectsPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('renovation');
  const [propertyType, setPropertyType] = useState<PropertyType | ''>('');
  const [district, setDistrict] = useState('');
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
      const project = await createProject({
        title,
        description: description.trim() || undefined,
        projectType,
        propertyType: propertyType || undefined,
        district: district.trim() || undefined,
      });
      router.push(`/projects/${project.id}`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NOT_AUTHENTICATED') {
        setLoginOpen(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create project');
      }
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
            Create and track construction or renovation projects. AI will refine
            the description and suggest tags after creation.
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
                  Description
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe scope, materials, timeline…"
                    rows={4}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Project type
                    <select
                      value={projectType}
                      onChange={(event) =>
                        setProjectType(event.target.value as ProjectType)
                      }
                    >
                      {PROJECT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Property type
                    <select
                      value={propertyType}
                      onChange={(event) =>
                        setPropertyType(event.target.value as PropertyType | '')
                      }
                    >
                      <option value="">Not specified</option>
                      {PROPERTY_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  District / area
                  <input
                    type="text"
                    value={district}
                    onChange={(event) => setDistrict(event.target.value)}
                    placeholder="e.g. Sukhumvit, Bangkok"
                  />
                </label>
                <button
                  type="submit"
                  className="primary"
                  disabled={creating || title.trim().length < 3}
                >
                  {creating ? 'Creating & analyzing…' : 'Create project'}
                </button>
              </form>
            </section>

            <section className="card">
              <h2 className="section-title">Projects ({projects.length})</h2>
              {projects.length === 0 ? (
                <p className="muted">No projects yet. Create your first one above.</p>
              ) : (
                <ul className="project-list">
                  {projects.map((project) => (
                    <li key={project.id} className="project-item">
                      <div>
                        <Link
                          href={`/projects/${project.id}`}
                          className="project-link"
                        >
                          {project.title}
                        </Link>
                        <p className="project-subline muted">
                          {formatProjectType(project.projectType)}
                          {project.district ? ` · ${project.district}` : ''}
                        </p>
                        {project.description && (
                          <p className="project-description">
                            {project.description}
                          </p>
                        )}
                        {project.tags.length > 0 && (
                          <div className="tag-list">
                            {project.tags.slice(0, 5).map((tag) => (
                              <span key={tag.slug} className="tag-pill">
                                {tag.label}
                              </span>
                            ))}
                            {project.tags.length > 5 && (
                              <span className="tag-pill tag-pill-more">
                                +{project.tags.length - 5}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="project-meta">
                        <span className="status-pill">
                          {formatProjectStatus(project.status)}
                        </span>
                        <span className="readiness-badge">
                          {project.readinessScore}% ready
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
