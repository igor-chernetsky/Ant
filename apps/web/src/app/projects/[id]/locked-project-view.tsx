'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { canOpenProjectDetail, getProjectOpenBlockReason } from '@/lib/project-open-access';
import type { LockedPublicProject } from '@/lib/public-projects';

/**
 * Read-only teaser for a discoverable project the viewer may not open.
 *
 * Rendered on the server so crawlers get real content (title, description,
 * location, work list) instead of a 404, and so the project URL stays
 * indexable. Interactive only for the sign-in / re-open affordances.
 */
export function LockedProjectView({
  project,
}: {
  project: LockedPublicProject;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { me, refreshSession, signOut } = useSession();
  const { formatProjectStatus, formatProjectType, formatPropertyType, formatTagLabel } =
    useAppFormatters();
  const [loginOpen, setLoginOpen] = useState(false);

  const canOpen = canOpenProjectDetail(project.status, { me });
  const blockReason = getProjectOpenBlockReason(project.status, {
    me,
    projectType: project.projectType,
  });
  const locationLabel =
    project.district?.trim() ||
    project.locationNote?.trim() ||
    project.locationAreaSlug ||
    project.locationRegionSlug;
  // Deterministic on server and client — avoids a hydration mismatch.
  const updatedLabel = project.updatedAt.slice(0, 10);

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <PageShell className="page-shell--project">
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main className="project-detail-main main-content">
        <div className="project-detail-layout">
          <div className="project-detail-primary">
            <section className="card project-locked-card">
              <span className="status-pill status-pill-lg">
                {formatProjectStatus(project.status)}
              </span>
              <h1 className="page-title project-locked-title">{project.title}</h1>
              {project.description ? (
                <p className="project-locked-description">{project.description}</p>
              ) : null}

              <dl className="meta-grid">
                <div>
                  <dt>{t('projectLocked.type')}</dt>
                  <dd>{formatProjectType(project.projectType)}</dd>
                </div>
                {project.propertyType ? (
                  <div>
                    <dt>{t('projectLocked.propertyType')}</dt>
                    <dd>{formatPropertyType(project.propertyType)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>{t('projectLocked.location')}</dt>
                  <dd>{locationLabel}</dd>
                </div>
                <div>
                  <dt>{t('projectLocked.readiness')}</dt>
                  <dd>
                    {t('projectHero.readyPercent', {
                      n: project.readinessScore,
                    })}
                  </dd>
                </div>
                <div>
                  <dt>{t('projectLocked.proposals')}</dt>
                  <dd>{project.bidCount}</dd>
                </div>
                <div>
                  <dt>{t('projectLocked.updated')}</dt>
                  <dd>{updatedLabel}</dd>
                </div>
              </dl>

              {project.workPackages.length > 0 ? (
                <div className="project-locked-section">
                  <h2 className="section-title">{t('projectLocked.works')}</h2>
                  <ul className="project-locked-works">
                    {project.workPackages.map((trade) => (
                      <li key={trade}>{trade}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {project.tags.length > 0 ? (
                <div className="project-hero-tags project-locked-section">
                  <p className="project-hero-tags-label">
                    {t('projectHero.scopeTags')}
                  </p>
                  <div
                    className="project-hero-tag-list"
                    aria-label={t('projectHero.scopeTagsAria')}
                  >
                    {project.tags.map((tag) => (
                      <span key={tag.slug} className="tag-pill">
                        {formatTagLabel(tag.slug, tag.label)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="project-locked-cta">
                {!canOpen && blockReason ? (
                  <p className="muted">
                    {t(`projectLocked.reason.${blockReason}`)}
                  </p>
                ) : null}
                {canOpen ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => router.refresh()}
                  >
                    {t('projectLocked.open')}
                  </button>
                ) : me ? (
                  <p className="muted">{t('projectLocked.contactHint')}</p>
                ) : (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setLoginOpen(true)}
                  >
                    {t('header.signIn')}
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          void (async () => {
            await refreshSession();
            setLoginOpen(false);
            router.refresh();
          })();
        }}
      />
    </PageShell>
  );
}
