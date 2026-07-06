import { ProjectStatus } from '@prisma/client';

/** Statuses shown on the public homepage by default (excludes completed). */
export const DISCOVERY_STATUSES: ProjectStatus[] = [
  ProjectStatus.ready_for_estimate,
  ProjectStatus.estimated,
  ProjectStatus.in_tender,
  ProjectStatus.awarded,
  ProjectStatus.active,
];

export const DISCOVERY_FILTER_HIDDEN = 'hidden';

export const PUBLIC_VIEW_STATUSES: ProjectStatus[] = [
  ...DISCOVERY_STATUSES,
  ProjectStatus.completed,
];

export function isPubliclyViewable(status: ProjectStatus): boolean {
  return PUBLIC_VIEW_STATUSES.includes(status);
}

export function isPubliclyDiscoverable(project: {
  status: ProjectStatus;
  isHidden: boolean;
}): boolean {
  return isPubliclyViewable(project.status) && !project.isHidden;
}
