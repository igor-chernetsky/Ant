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
  type ProjectOpenBlockReason,
} from '@/lib/project-open-access';
import type { ProjectType } from '@/lib/projects';
import type { PublicProjectCard } from '@/lib/public-projects';
import { isContractorUser, isDesignerUser } from '@/lib/session';
import type { ContractorApplicationItem } from '@/lib/tendering';

interface ProjectTileProps {
  project: PublicProjectCard;
  isOwned?: boolean;
  contractorParticipation?: ContractorApplicationItem | null;
}

function LockIcon() {
  return (
    <svg
      className="project-tile-lock-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Zm7 13H7v-9h10v9Zm-5-3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      />
    </svg>
  );
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

  const isAwardedContractor =
    contractorParticipation?.bidStatus === 'selected' ||
    Boolean(contractorParticipation?.isActiveProject);

  const openContext = {
    me,
    isOwned,
    isAwardedContractor,
    projectType: project.projectType,
  };
  // Prefer client ACL so admin/owner stay unlocked even if the list was
  // fetched anonymously (canOpenDetail: false) before login.
  const canOpen =
    canOpenProjectDetail(project.status, openContext) ||
    project.canOpenDetail === true;
  const blockReason = getProjectOpenBlockReason(project.status, openContext);

  const lockedMessage = lockedMessageForReason(blockReason, t);

  const excerpt =
    project.description && project.description.length > 160
      ? `${project.description.slice(0, 157)}…`
      : project.description;

  const participationLabel = contractorParticipation
    ? formatParticipationLabel(contractorParticipation)
    : null;

  const needsSignIn =
    blockReason === 'login_designer' || blockReason === 'login_contractor';

  const className = `project-tile${isOwned ? ' project-tile-owned' : ''}${
    contractorParticipation && !isOwned ? ' project-tile-participating' : ''
  }${!canOpen ? ' project-tile-locked' : ''}${
    needsSignIn ? ' project-tile-locked--signin' : ''
  }`;

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
        {!canOpen && (
          <span className="project-tile-lock-badge" aria-hidden>
            <LockIcon />
          </span>
        )}
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
        {!canOpen && lockedMessage && (
          <p className="project-tile-access-hint" role="status">
            <LockIcon />
            <span>{lockedMessage}</span>
          </p>
        )}
      </div>
    </>
  );

  const handleLockedClick = () => {
    if (
      blockReason === 'login_designer' ||
      blockReason === 'login_contractor'
    ) {
      setLoginOpen(true);
    }
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
          onClick={() => void handleLockedClick()}
          aria-label={t('projectTile.lockedAria', {
            title: project.title || project.id,
          })}
        >
          {body}
        </button>
      )}

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={async () => {
          setLoginOpen(false);
          const nextMe = await refreshSession();
          if (
            canOpenProjectDetail(project.status, {
              me: nextMe,
              isOwned,
              isAwardedContractor,
              projectType: project.projectType,
            })
          ) {
            router.push(`/projects/${project.id}`);
          }
        }}
      />
    </>
  );
}

function lockedMessageForReason(
  reason: ProjectOpenBlockReason,
  t: (key: string) => string,
): string | null {
  switch (reason) {
    case 'login_designer':
      return t('projectTile.signInDesignerHint');
    case 'login_contractor':
      return t('projectTile.signInContractorHint');
    case 'designer_only':
      return t('projectTile.designerOnlyHint');
    case 'contractor_only':
      return t('projectTile.contractorOnlyHint');
    case 'parties_only':
      return t('projectTile.partiesOnlyHint');
    default:
      return t('projectTile.lockedGenericHint');
  }
}
