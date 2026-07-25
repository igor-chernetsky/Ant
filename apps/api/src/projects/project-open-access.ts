import { ProjectStatus } from '@prisma/client';

/**
 * Statuses any registered contractor may open (Accepting bids).
 * Listing remains public; opening requires a contractor account.
 */
export const CONTRACTOR_OPEN_STATUSES: ProjectStatus[] = [
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
  isAwardedContractor?: boolean;
};

/**
 * Whether a viewer may open the project detail (not merely see the card).
 * Listing/discovery is separate from this gate.
 */
export function canOpenProjectDetail(
  status: ProjectStatus,
  viewer: ProjectOpenViewer,
): boolean {
  if (viewer.isAdmin || viewer.isOwner) {
    return true;
  }

  if (CONTRACTOR_OPEN_STATUSES.includes(status)) {
    return Boolean(viewer.isContractor);
  }

  if (RESTRICTED_OPEN_STATUSES.includes(status)) {
    return Boolean(viewer.isAwardedContractor);
  }

  return false;
}
