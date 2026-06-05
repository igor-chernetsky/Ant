import { ProjectStatus } from '@prisma/client';

export const AMENDABLE_STATUSES: ProjectStatus[] = [
  ProjectStatus.draft,
  ProjectStatus.intake,
  ProjectStatus.ready_for_estimate,
  ProjectStatus.estimated,
  ProjectStatus.tender_ready,
];

export function isAmendableStatus(status: ProjectStatus): boolean {
  return AMENDABLE_STATUSES.includes(status);
}
