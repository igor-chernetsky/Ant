import {
  isContractorUser,
  type MeResponse,
} from '@/lib/session';

const CONTRACTOR_OPEN_STATUSES = new Set(['in_tender']);
const RESTRICTED_OPEN_STATUSES = new Set([
  'awarded',
  'active',
  'completed',
]);

export type ProjectOpenContext = {
  me: MeResponse | null;
  isOwned?: boolean;
  /** True when the signed-in contractor won this tender. */
  isAwardedContractor?: boolean;
};

/**
 * Client-side mirror of API open-card ACL.
 * Cards stay visible; navigation should only happen when this returns true.
 */
export function canOpenProjectDetail(
  status: string,
  context: ProjectOpenContext,
): boolean {
  const { me, isOwned = false, isAwardedContractor = false } = context;

  if (isOwned) {
    return true;
  }
  if (me?.roles?.includes('admin')) {
    return true;
  }

  if (CONTRACTOR_OPEN_STATUSES.has(status)) {
    return isContractorUser(me);
  }

  if (RESTRICTED_OPEN_STATUSES.has(status)) {
    return isAwardedContractor;
  }

  return false;
}

export type ProjectOpenBlockReason =
  | 'login_contractor'
  | 'contractor_only'
  | 'parties_only'
  | null;

export function getProjectOpenBlockReason(
  status: string,
  context: ProjectOpenContext,
): ProjectOpenBlockReason {
  if (canOpenProjectDetail(status, context)) {
    return null;
  }

  if (CONTRACTOR_OPEN_STATUSES.has(status)) {
    return context.me ? 'contractor_only' : 'login_contractor';
  }

  if (RESTRICTED_OPEN_STATUSES.has(status)) {
    return 'parties_only';
  }

  return 'parties_only';
}
