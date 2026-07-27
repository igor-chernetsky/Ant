import { ProjectStatus, ProjectType } from '@prisma/client';

/**
 * Statuses any registered supply-side user may open (Clarification /
 * Accepting bids), subject to designer vs contractor matching project type.
 */
export const CONTRACTOR_OPEN_STATUSES: ProjectStatus[] = [
  ProjectStatus.clarification,
  ProjectStatus.in_tender,
];

/**
 * Statuses only the client owner, awarded contractor, and admins may open.
 * Cards may still appear in public discovery.
 */
export const RESTRICTED_OPEN_STATUSES: ProjectStatus[] = [
  ProjectStatus.awarded,
  ProjectStatus.active,
  ProjectStatus.completed,
];

export type ProjectOpenViewer = {
  isOwner?: boolean;
  isAdmin?: boolean;
  isContractor?: boolean;
  isDesigner?: boolean;
  isAwardedContractor?: boolean;
};

function supplySideMayOpenInTender(
  projectType: ProjectType | undefined,
  viewer: ProjectOpenViewer,
): boolean {
  if (projectType === ProjectType.design) {
    return Boolean(viewer.isDesigner);
  }
  return Boolean(viewer.isContractor);
}

/**
 * Whether a viewer may open the project detail (not merely see the card).
 * Listing/discovery is separate from this gate.
 */
export function canOpenProjectDetail(
  status: ProjectStatus,
  viewer: ProjectOpenViewer,
  projectType?: ProjectType,
): boolean {
  if (viewer.isAdmin || viewer.isOwner) {
    return true;
  }

  if (CONTRACTOR_OPEN_STATUSES.includes(status)) {
    return supplySideMayOpenInTender(projectType, viewer);
  }

  if (RESTRICTED_OPEN_STATUSES.includes(status)) {
    return Boolean(viewer.isAwardedContractor);
  }

  return false;
}
