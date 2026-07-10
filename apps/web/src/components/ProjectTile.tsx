'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import type { ProjectType } from '@/lib/projects';
import type { PublicProjectCard } from '@/lib/public-projects';
import type { ContractorApplicationItem } from '@/lib/tendering';

interface ProjectTileProps {
  project: PublicProjectCard;
  isOwned?: boolean;
  contractorParticipation?: ContractorApplicationItem | null;
}

export function ProjectTile({
  project,
  isOwned = false,
  contractorParticipation = null,
}: ProjectTileProps) {
  const { t } = useTranslation();
  const { formatProjectStatus, formatProjectType, formatParticipationLabel } =
    useAppFormatters();

  const excerpt =
    project.description && project.description.length > 160
      ? `${project.description.slice(0, 157)}…`
      : project.description;

  const participationLabel = contractorParticipation
    ? formatParticipationLabel(contractorParticipation)
    : null;

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`project-tile${isOwned ? ' project-tile-owned' : ''}${
        contractorParticipation && !isOwned ? ' project-tile-participating' : ''
      }`}
    >
      <div className="project-tile-media">
        {project.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverImageUrl}
            alt=""
            className="project-tile-image"
            loading="lazy"
          />
        ) : (
          <div className="project-tile-placeholder" aria-hidden>
            <span>{formatProjectType(project.projectType as ProjectType)}</span>
          </div>
        )}
        <span className="project-tile-status">
          {project.isHidden
            ? t('projectTile.hidden')
            : formatProjectStatus(project.status)}
        </span>
        {isOwned && project.applicationsDeadlinePassed && (
          <span
            className="project-tile-expired-badge"
            title={t('projectTile.deadlineExpiredTitle')}
            aria-label={t('projectTile.deadlineExpiredAria')}
          >
            !
          </span>
        )}
        {isOwned && (
          <span className="project-tile-owned-badge">{t('projectTile.myProject')}</span>
        )}
        {participationLabel && !isOwned && (
          <span className="project-tile-contractor-badge">
            {participationLabel}
          </span>
        )}
      </div>
      <div className="project-tile-body">
        <h3 className="project-tile-title">{project.title}</h3>
        <p className="project-tile-meta muted">
          {formatProjectType(project.projectType as ProjectType)}
          {project.district ? ` · ${project.district}` : ''}
        </p>
        {participationLabel && (
          <p className="project-tile-participation muted">{participationLabel}</p>
        )}
        {excerpt && <p className="project-tile-description">{excerpt}</p>}
        {project.tags.length > 0 && (
          <div className="project-tile-tags">
            {project.tags.slice(0, 4).map((tag) => (
              <span key={tag.slug} className="tag-pill tag-pill-ai">
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
