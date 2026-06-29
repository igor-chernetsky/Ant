'use client';

import Link from 'next/link';
import {
  formatDateTime,
  formatProjectStatus,
  formatProjectType,
  formatPropertyType,
  type Project,
  type ProjectTag,
} from '@/lib/projects';

interface ProjectHeroProps {
  project: Project;
  estimateMidAmountThb?: number | null;
  tags?: ProjectTag[];
  showTags?: boolean;
  tagsHint?: string | null;
}

export function ProjectHero({
  project,
  estimateMidAmountThb,
  tags = [],
  showTags = false,
  tagsHint = null,
}: ProjectHeroProps) {
  const chips = [
    formatProjectType(project.projectType),
    formatPropertyType(project.propertyType),
    project.district,
    project.regionCode,
  ].filter((value) => value && value !== '—');

  return (
    <section className="project-hero" aria-labelledby="project-hero-title">
      <div className="project-hero-body">
        <div className="project-hero-main">
          <p className="project-hero-kicker">
            <Link href="/" className="project-hero-back-link">
              Projects
            </Link>
          </p>
          <h1 id="project-hero-title">{project.title}</h1>
          {project.description ? (
            <p className="project-hero-lead">{project.description}</p>
          ) : (
            <p className="project-hero-lead project-hero-lead-muted">
              Add a short description so contractors can quickly understand the scope.
            </p>
          )}
          {chips.length > 0 && (
            <ul className="project-hero-chips" aria-label="Project highlights">
              {chips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          )}
          <p className="muted project-hero-timestamps">
            Created {formatDateTime(project.createdAt)}
            {' · '}
            Updated {formatDateTime(project.updatedAt)}
          </p>
        </div>
        <div className="project-hero-aside">
          <span className="status-pill status-pill-lg project-hero-status">
            {project.isHidden ? 'Hidden' : formatProjectStatus(project.status)}
          </span>
          <div className="project-hero-aside-metrics">
            <span className="readiness-badge readiness-badge-lg project-hero-readiness">
              {project.readinessScore}% ready
            </span>
            {typeof estimateMidAmountThb === 'number' && estimateMidAmountThb > 0 && (
              <p className="project-hero-meta">
                Ballpark midpoint&nbsp;
                <span className="project-hero-meta-value">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'THB',
                    maximumFractionDigits: 0,
                  }).format(estimateMidAmountThb)}
                </span>
              </p>
            )}
          </div>
          {showTags && tags.length > 0 && (
            <div className="project-hero-tags">
              <p className="project-hero-tags-label">Scope tags</p>
              <div className="project-hero-tag-list" aria-label="Project scope tags">
                {tags.map((tag) => (
                  <span
                    key={tag.slug}
                    className={`tag-pill${
                      tag.source === 'client'
                        ? ' tag-pill-client'
                        : ' tag-pill-ai'
                    }`}
                    title={
                      tag.source === 'client'
                        ? 'Selected during intake'
                        : 'Suggested by AI'
                    }
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
              {tagsHint && <p className="project-hero-tags-hint muted">{tagsHint}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
