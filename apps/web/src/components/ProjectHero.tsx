'use client';

import {
  formatProjectStatus,
  formatProjectType,
  formatPropertyType,
  type Project,
} from '@/lib/projects';

interface ProjectHeroProps {
  project: Project;
}

export function ProjectHero({ project }: ProjectHeroProps) {
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
          <p className="project-hero-kicker">Project</p>
          <h1 id="project-hero-title">{project.title}</h1>
          {project.description ? (
            <p className="project-hero-lead">{project.description}</p>
          ) : (
            <p className="project-hero-lead project-hero-lead-muted">
              No description yet. Add details in intake or upload project documents.
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
          <span className="readiness-badge readiness-badge-lg project-hero-readiness">
            {project.readinessScore}% ready
          </span>
        </div>
      </div>
    </section>
  );
}
