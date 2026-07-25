'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { useSession } from '@/components/SessionProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  canOpenProjectDetail,
  getProjectOpenBlockReason,
} from '@/lib/project-open-access';
import type { ProjectType } from '@/lib/projects';
import type { PublicProjectCard } from '@/lib/public-projects';
import { isContractorUser } from '@/lib/session';
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
  const router = useRouter();
  const { t } = useTranslation();
  const { me, refreshSession } = useSession();
  const { formatProjectStatus, formatProjectType, formatParticipationLabel } =
    useAppFormatters();
  const [loginOpen, setLoginOpen] = useState(false);
  const [accessHint, setAccessHint] = useState<string | null>(null);

  const isAwardedContractor =
    contractorParticipation?.bidStatus === 'selected' ||
    Boolean(contractorParticipation?.isActiveProject);

  const openContext = {
    me,
    isOwned,
    isAwardedContractor,
  };
  const canOpen = canOpenProjectDetail(project.status, openContext);
  const blockReason = getProjectOpenBlockReason(project.status, openContext);

  const excerpt =
    project.description && project.description.length > 160
      ? `${project.description.slice(0, 157)}…`
      : project.description;

  const participationLabel = contractorParticipation
    ? formatParticipationLabel(contractorParticipation)
    : null;

  const className = `project-tile${isOwned ? ' project-tile-owned' : ''}${
    contractorParticipation && !isOwned ? ' project-tile-participating' : ''
  }${!canOpen ? ' project-tile-locked' : ''}`;

  const body = (
    <>
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
          <span className="project-tile-owned-badge">
            {t('projectTile.myProject')}
          </span>
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
        {accessHint && (
          <p className="project-tile-access-hint muted" role="status">
            {accessHint}
          </p>
        )}
      </div>
    </>
  );

  const handleLockedClick = () => {
    if (blockReason === 'login_contractor') {
      setAccessHint(t('projectTile.signInContractorHint'));
      setLoginOpen(true);
      return;
    }
    if (blockReason === 'contractor_only') {
      setAccessHint(t('projectTile.contractorOnlyHint'));
      return;
    }
    setAccessHint(t('projectTile.partiesOnlyHint'));
  };

  return (
    <>
      {canOpen ? (
        <Link href={`/projects/${project.id}`} className={className}>
          {body}
        </Link>
      ) : (
        <button
          type="button"
          className={className}
          onClick={handleLockedClick}
          aria-label={t('projectTile.lockedAria', { title: project.title })}
        >
          {body}
        </button>
      )}

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={async () => {
          setLoginOpen(false);
          setAccessHint(null);
          const nextMe = await refreshSession();
          if (
            canOpenProjectDetail(project.status, {
              me: nextMe,
              isOwned,
              isAwardedContractor,
            })
          ) {
            router.push(`/projects/${project.id}`);
            return;
          }
          if (nextMe && !isContractorUser(nextMe)) {
            setAccessHint(t('projectTile.contractorOnlyHint'));
          } else {
            setAccessHint(t('projectTile.partiesOnlyHint'));
          }
        }}
      />
    </>
  );
}
