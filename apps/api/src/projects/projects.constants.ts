import { ProjectStatus } from '@prisma/client';

export const PUBLIC_VIEW_STATUSES: ProjectStatus[] = [
  ProjectStatus.ready_for_estimate,
  ProjectStatus.estimated,
  ProjectStatus.in_tender,
  ProjectStatus.contractor_selected,
  ProjectStatus.active,
  ProjectStatus.completed,
];

export function isPubliclyViewable(status: ProjectStatus): boolean {
  return PUBLIC_VIEW_STATUSES.includes(status);
}
