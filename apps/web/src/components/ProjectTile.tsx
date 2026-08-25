'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EstimateConfidenceRing } from '@/components/EstimateConfidenceRing';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { useSession } from '@/components/SessionProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { formatThb, isLowEstimateConfidence } from '@/lib/estimate';
import {
  canOpenProjectDetail,
  getProjectOpenBlockReason,
  type ProjectOpenBlockReason,
} from '@/lib/project-open-access';
import type { PublicProjectCard } from '@/lib/public-projects';
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

/** Compass / drawing board — Design & Permits */
function DesignPhaseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M12 2a1 1 0 0 1 .9.55l1.7 3.45 3.8.55a1 1 0 0 1 .55 1.7l-2.75 2.68.65 3.8a1 1 0 0 1-1.45 1.05L12 14.9l-3.4 1.78a1 1 0 0 1-1.45-1.05l.65-3.8L5.05 8.25a1 1 0 0 1 .55-1.7l3.8-.55L11.1 2.55A1 1 0 0 1 12 2Zm0 3.2L10.85 7.5a1 1 0 0 1-.75.55l-2.55.37 1.85 1.8a1 1 0 0 1 .29.89l-.44 2.55 2.28-1.2a1 1 0 0 1 .94 0l2.28 1.2-.44-2.55a1 1 0 0 1 .29-.89l1.85-1.8-2.55-.37a1 1 0 0 1-.75-.55L12 5.2Z"
      />
      <path
        fill="currentColor"
        d="M4.5 19.25h15a.75.75 0 0 1 0 1.5h-15a.75.75 0 0 1 0-1.5Z"
        opacity="0.85"
      />
    </svg>
  );
}

/** Building blocks — Construction */
function ConstructionPhaseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M4 20.25V9.5a.75.75 0 0 1 .75-.75H9V5.75A.75.75 0 0 1 9.75 5h4.5a.75.75 0 0 1 .75.75V8.75h4a.75.75 0 0 1 .75.75v10.75a.75.75 0 0 1-.75.75H4.75a.75.75 0 0 1-.75-.75Zm1.5-.75h13V10.25h-3.5v2.25a.75.75 0 0 1-1.5 0V10.25h-3v9.25h-1.5V10.25H8v9.25H5.5Zm5.5-13.5v2.5h2.5v-2.5h-2.5Z"
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
  const { formatProjectStatus, formatParticipationLabel, formatTagLabel } =
    useAppFormatters();
  const [loginOpen, setLoginOpen] = useState(false);
  const [accessDeniedOpen, setAccessDeniedOpen] = useState(false);

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

  const lockedMessage = lockedMessageForReason(
    blockReason,
    project.status,
    t,
  );

  const excerpt =
    project.description && project.description.length > 160
      ? `${project.description.slice(0, 157)}…`
      : project.description;

  const participationLabel = contractorParticipation
    ? formatParticipationLabel(contractorParticipation)
    : null;

  const needsSignIn = !me && !canOpen;

  const isDesignPhase = project.projectType === 'design';
  const phaseLabel = isDesignPhase
    ? t('projectTile.phaseDesign')
    : t('projectTile.phaseConstruction');
  const phaseAria = isDesignPhase
    ? t('projectTile.phaseDesignAria')
    : t('projectTile.phaseConstructionAria');

  const className = `project-tile project-tile--${
    isDesignPhase ? 'design' : 'construction'
  }${isOwned ? ' project-tile-owned' : ''}${
    contractorParticipation && !isOwned ? ' project-tile-participating' : ''
  }${!canOpen ? ' project-tile-locked' : ''}${
    needsSignIn ? ' project-tile-locked--signin' : ''
  }`;

  const statusTone = project.isHidden ? 'hidden' : project.status;

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
            <span className="project-tile-placeholder-icon">
              {isDesignPhase ? <DesignPhaseIcon /> : <ConstructionPhaseIcon />}
            </span>
          </div>
        )}
        <span className={`project-tile-status project-tile-status--${statusTone}`}>
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
        <span
          className={`project-tile-phase-chip project-tile-phase-chip--${
            isDesignPhase ? 'design' : 'construction'
          }`}
          title={phaseAria}
          aria-label={phaseAria}
        >
          <span className="project-tile-phase-chip-icon" aria-hidden>
            {isDesignPhase ? <DesignPhaseIcon /> : <ConstructionPhaseIcon />}
          </span>
          {phaseLabel}
        </span>
      </div>
      <div className="project-tile-body">
        <h3 className="project-tile-title">{project.title}</h3>
        {project.district ? (
          <p className="project-tile-meta muted">{project.district}</p>
        ) : null}
        {participationLabel && (
          <p className="project-tile-participation muted">{participationLabel}</p>
        )}
        {excerpt && <p className="project-tile-description">{excerpt}</p>}
        {isOwned && project.estimate && (
          <div className="project-tile-estimate-block">
            <div className="project-tile-estimate">
              <div className="project-tile-estimate-main">
                <p className="project-tile-estimate-label">
                  {isDesignPhase
                    ? t('projectTile.ballparkDesign')
                    : t('projectTile.ballpark')}
                </p>
                <p className="project-tile-estimate-range">
                  {formatThb(project.estimate.minAmount)} –{' '}
                  {formatThb(project.estimate.maxAmount)}
                </p>
              </div>
              <EstimateConfidenceRing
                confidence={project.estimate.confidence}
                size={56}
                showCaption={false}
              />
            </div>
            {isLowEstimateConfidence(project.estimate.confidence) && (
              <p className="project-tile-estimate-low-confidence" role="status">
                {t('estimateSection.lowConfidenceHint')}
              </p>
            )}
          </div>
        )}
        {project.tags.length > 0 && (
          <div className="project-tile-tags">
            {project.tags.slice(0, 4).map((tag) => (
              <span key={tag.slug} className="tag-pill tag-pill-ai">
                {formatTagLabel(tag.slug, tag.label)}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const handleLockedClick = () => {
    if (!me) {
      setLoginOpen(true);
      return;
    }
    setAccessDeniedOpen(true);
  };

  const tryOpenAfterLogin = async () => {
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
      return;
    }
    setAccessDeniedOpen(true);
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
        onSuccess={() => {
          void tryOpenAfterLogin();
        }}
      />

      <ConfirmDialog
        isOpen={accessDeniedOpen}
        hideCancel
        title={t('projectTile.accessDeniedTitle')}
        message={
          lockedMessage ?? t('projectTile.lockedGenericHint')
        }
        confirmLabel={t('common.close')}
        onConfirm={() => setAccessDeniedOpen(false)}
        onCancel={() => setAccessDeniedOpen(false)}
      />
    </>
  );
}

function lockedMessageForReason(
  reason: ProjectOpenBlockReason,
  status: string,
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
      if (status === 'awarded') {
        return t('projectTile.accessDeniedAwarded');
      }
      if (status === 'active') {
        return t('projectTile.accessDeniedActive');
      }
      if (status === 'completed') {
        return t('projectTile.accessDeniedCompleted');
      }
      return t('projectTile.partiesOnlyHint');
    default:
      return t('projectTile.lockedGenericHint');
  }
}
