'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { SiteHeader } from '@/components/SiteHeader';
import {
  fetchProject,
  formatDateTime,
  formatProjectStatus,
  formatProjectType,
  formatPropertyType,
  type Project,
} from '@/lib/projects';
import {
  fetchSessionProfile,
  logoutSession,
  type MeResponse,
} from '@/lib/session';

type AuthState = 'loading' | 'guest' | 'authenticated';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [authState, setAuthState] = useState<AuthState>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadProject = useCallback(async () => {
    if (!projectId) {
      return;
    }
    const data = await fetchProject(projectId);
    setProject(data);
  }, [projectId]);

  const refreshSession = useCallback(async () => {
    setError(null);
    setProject(null);
    const profile = await fetchSessionProfile();
    if (profile) {
      setMe(profile);
      setAuthState('authenticated');
      await loadProject();
    } else {
      setMe(null);
      setAuthState('guest');
    }
  }, [loadProject]);

  useEffect(() => {
    refreshSession().catch((err: unknown) => {
      if (err instanceof Error && err.message === 'NOT_AUTHENTICATED') {
        setAuthState('guest');
        return;
      }
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        setError('Project not found or you do not have access.');
        setAuthState('authenticated');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load project');
      setAuthState('guest');
    });
  }, [refreshSession]);

  const handleLogout = async () => {
    await logoutSession();
    setMe(null);
    setProject(null);
    setAuthState('guest');
  };

  const clientTags = project?.tags.filter((t) => t.source === 'client') ?? [];
  const aiTags = project?.tags.filter((t) => t.source === 'ai') ?? [];

  return (
    <>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main>
        <p className="breadcrumb">
          <Link href="/projects">← Back to projects</Link>
        </p>

        {authState === 'loading' && (
          <section className="card">
            <p className="muted">Loading…</p>
          </section>
        )}

        {authState === 'guest' && (
          <section className="card cta">
            <p>Sign in to view this project.</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              Sign in
            </button>
          </section>
        )}

        {authState === 'authenticated' && project && (
          <>
            <section className="hero card">
              <div className="detail-header">
                <div>
                  <h1>{project.title}</h1>
                  {project.description && (
                    <p className="detail-description">{project.description}</p>
                  )}
                </div>
                <div className="detail-badges">
                  <span className="status-pill status-pill-lg">
                    {formatProjectStatus(project.status)}
                  </span>
                  <span className="readiness-badge readiness-badge-lg">
                    {project.readinessScore}% ready
                  </span>
                </div>
              </div>
            </section>

            <section className="card">
              <h2 className="section-title">Overview</h2>
              <dl className="meta-grid">
                <div>
                  <dt>Project type</dt>
                  <dd>{formatProjectType(project.projectType)}</dd>
                </div>
                <div>
                  <dt>Property</dt>
                  <dd>{formatPropertyType(project.propertyType)}</dd>
                </div>
                <div>
                  <dt>District</dt>
                  <dd>{project.district ?? '—'}</dd>
                </div>
                <div>
                  <dt>Region</dt>
                  <dd>{project.regionCode}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(project.createdAt)}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{formatDateTime(project.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            {project.tags.length > 0 && (
              <section className="card">
                <h2 className="section-title">Tags</h2>
                {clientTags.length > 0 && (
                  <>
                    <h3 className="tag-section-label">Selected by you</h3>
                    <div className="tag-list">
                      {clientTags.map((tag) => (
                        <span key={tag.slug} className="tag-pill tag-pill-client">
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {aiTags.length > 0 && (
                  <>
                    <h3 className="tag-section-label">Suggested by AI</h3>
                    <div className="tag-list">
                      {aiTags.map((tag) => (
                        <span key={tag.slug} className="tag-pill tag-pill-ai">
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {project.brief && (
              <section className="card">
                <h2 className="section-title">Project brief</h2>
                {project.brief.summary && (
                  <p className="brief-summary">{project.brief.summary}</p>
                )}
                {project.brief.ai?.missingFields &&
                  project.brief.ai.missingFields.length > 0 && (
                    <p className="muted">
                      Missing details:{' '}
                      {project.brief.ai.missingFields.join(', ')}
                    </p>
                  )}
                {project.brief.design && (
                  <dl className="meta-grid brief-meta">
                    <div>
                      <dt>Plans available</dt>
                      <dd>{project.brief.design.hasPlans ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt>Design tender needed</dt>
                      <dd>
                        {project.brief.design.needsDesignTender ? 'Yes' : 'No'}
                      </dd>
                    </div>
                  </dl>
                )}
              </section>
            )}

            <section className="card">
              <h2 className="section-title">Next steps</h2>
              <p className="muted">
                This project is in <strong>{formatProjectStatus(project.status)}</strong>{' '}
                status. AI-assisted intake and cost estimation will expand the brief
                and refine tags in the next release.
              </p>
            </section>
          </>
        )}

        {authState === 'authenticated' && !project && error && (
          <section className="card error">
            <p>{error}</p>
            <Link href="/projects" className="text-link">
              Return to projects
            </Link>
          </section>
        )}

        {error && project && (
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
