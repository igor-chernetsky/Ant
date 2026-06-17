'use client';

import {
  formatProjectStatus,
  formatProjectType,
  formatPropertyType,
  type Project,
} from '@/lib/projects';

interface ProjectHeroProps {
  project: Project;
  estimateMidAmountThb?: number | null;
}

export function ProjectHero({ project, estimateMidAmountThb }: ProjectHeroProps) {
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
          <p className="project-hero-kicker">Project overview</p>
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
        </div>
        <div className="project-hero-aside">
          <span className="status-pill status-pill-lg project-hero-status">
            {formatProjectStatus(project.status)}
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
        </div>
      </div>
    </section>
  );
}
