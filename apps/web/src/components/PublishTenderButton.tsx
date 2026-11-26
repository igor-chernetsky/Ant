'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { PublishTenderPackageModal } from '@/components/PublishTenderPackageModal';
import {
  defaultApplicationsCloseDateString,
  type ApplicationsDeadlineValue,
} from '@/components/TenderApplicationsDeadlineFields';
import type { Project } from '@/lib/projects';

interface PublishTenderButtonProps {
  projectId: string;
  project: Project;
  /** `start` opens an existing draft tender; `create` publishes for the first time. */
  mode?: 'create' | 'start';
  className?: string;
  label?: string;
  /** Refresh the project after publishing (the estimate card and the sidebar use it). */
  onPublished?: () => void | Promise<void>;
}

/**
 * Publish is possible while the estimate exists and the tender has not been opened
 * yet (or the project is still collecting clarification questions).
 */
export function canPublishTenderNow(project: Pick<Project, 'status'>): boolean {
  return project.status === 'estimated' || project.status === 'clarification';
}

/**
 * "Publish for bids" as a self-contained control.
 *
 * The publish form used to live only inside the tender card at the bottom of the
 * page, so the client had to scroll past the estimate to find the action the whole
 * page is about. The same control now sits in the estimate card, in the sticky
 * sidebar and in the mobile bottom bar — one component, so all three behave alike.
 */
export function PublishTenderButton({
  projectId,
  project,
  mode = 'create',
  className = 'primary',
  label,
  onPublished,
}: PublishTenderButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [deadline] = useState<ApplicationsDeadlineValue>(() => ({
    applicationsCloseAt: defaultApplicationsCloseDateString(),
    noApplicationsDeadline: false,
  }));

  if (!canPublishTenderNow(project)) {
    return null;
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label ?? t('tenderCard.publishForBids')}
      </button>
      <PublishTenderPackageModal
        projectId={projectId}
        project={project}
        mode={mode}
        structuredQa={project.clarificationMode === 'structured_qa'}
        deadline={deadline}
        isOpen={open}
        onClose={() => setOpen(false)}
        onPublished={async () => {
          await onPublished?.();
          setOpen(false);
        }}
      />
    </>
  );
}
