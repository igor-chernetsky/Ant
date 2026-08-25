import { ProjectStatus } from '@prisma/client';

/**
 * Statuses shown on the public homepage by default.
 * Includes Accepting bids through Winner selected / Active — cards stay visible
 * after the applications deadline; opening is locked for non-parties once awarded.
 * Pre-tender stages stay client-only until the client publishes a tender.
 *
 * TEMP: completed is included on the homepage for now (normally only via Completed filter).
 */
export const DISCOVERY_STATUSES: ProjectStatus[] = [
  ProjectStatus.clarification,
  ProjectStatus.in_tender,
  ProjectStatus.awarded,
  ProjectStatus.active,
  ProjectStatus.completed,
];

/** Owner-only workspace statuses (visible on home to the creating client). */
export const CLIENT_WORKSPACE_STATUSES: ProjectStatus[] = [
  ProjectStatus.draft,
  ProjectStatus.intake,
  ProjectStatus.ready_for_estimate,
  ProjectStatus.estimated,
  ProjectStatus.pending,
];

export const DISCOVERY_FILTER_HIDDEN = 'hidden';

/**
 * Statuses that appear on public cards / discovery.
 * Opening a card uses canOpenProjectDetail, not this list alone.
 */
export const PUBLIC_VIEW_STATUSES: ProjectStatus[] = [...DISCOVERY_STATUSES];

export function isPubliclyViewable(status: ProjectStatus): boolean {
  return PUBLIC_VIEW_STATUSES.includes(status);
}

export function isPubliclyDiscoverable(project: {
  status: ProjectStatus;
  isHidden: boolean;
}): boolean {
  return isPubliclyViewable(project.status) && !project.isHidden;
}

export {
  CONTRACTOR_OPEN_STATUSES,
  RESTRICTED_OPEN_STATUSES,
  canOpenProjectDetail,
  type ProjectOpenViewer,
} from './project-open-access';
