'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/LocaleProvider';
import { ProjectLocationMap } from '@/components/ProjectLocationMap';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { formatDateTime, type Project, type ProjectTag } from '@/lib/projects';

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
  const { t, locale } = useTranslation();
  const { formatProjectStatus, formatProjectType, formatPropertyType } =
    useAppFormatters();

  const chips = [
    formatProjectType(project.projectType),
    formatPropertyType(project.propertyType),
    project.district,
    project.regionCode,
  ].filter((value) => value && value !== t('common.dash'));

  return (
    <section className="project-hero" aria-labelledby="project-hero-title">
      <div className="project-hero-body">
        <div className="project-hero-main">
          <p className="project-hero-kicker">
            <Link href="/" className="project-hero-back-link">
              {t('projectHero.projectsBreadcrumb')}
            </Link>
          </p>
          <h1 id="project-hero-title">{project.title}</h1>
          {project.description ? (
            <p className="project-hero-lead">{project.description}</p>
          ) : (
            <p className="project-hero-lead project-hero-lead-muted">
              {t('projectHero.noDescription')}
            </p>
          )}
          {chips.length > 0 && (
            <ul
              className="project-hero-chips"
              aria-label={t('projectHero.highlightsAria')}
            >
              {chips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          )}
          <p className="muted project-hero-timestamps">
            {t('projectHero.created')} {formatDateTime(project.createdAt)}
            {' · '}
            {t('projectHero.updated')} {formatDateTime(project.updatedAt)}
          </p>
        </div>
        <div className="project-hero-aside">
          <span className="status-pill status-pill-lg project-hero-status">
            {project.isHidden
              ? t('projectHero.hidden')
              : formatProjectStatus(project.status)}
          </span>
          <div className="project-hero-aside-metrics">
            <span className="readiness-badge readiness-badge-lg project-hero-readiness">
              {t('projectHero.readyPercent', { n: project.readinessScore })}
            </span>
            {typeof estimateMidAmountThb === 'number' && estimateMidAmountThb > 0 && (
              <p className="project-hero-meta">
                {t('projectHero.ballparkMidpoint')}&nbsp;
                <span className="project-hero-meta-value">
                  {new Intl.NumberFormat(locale, {
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
              <p className="project-hero-tags-label">{t('projectHero.scopeTags')}</p>
              <div
                className="project-hero-tag-list"
                aria-label={t('projectHero.scopeTagsAria')}
              >
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
                        ? t('projectHero.tagSelectedDuringIntake')
                        : t('projectHero.tagSuggestedByAi')
                    }
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
              {tagsHint && <p className="project-hero-tags-hint muted">{tagsHint}</p>}
            </div>
          )}
          {project.locationRegionSlug ? (
            <ProjectLocationMap
              regionSlug={project.locationRegionSlug}
              areaSlug={project.locationAreaSlug}
              caption={project.district}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
