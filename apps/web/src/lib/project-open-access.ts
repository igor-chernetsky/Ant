import {
  isContractorUser,
  isDesignerUser,
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
  /** True when the signed-in supply-side user won this tender. */
  isAwardedContractor?: boolean;
  projectType?: string;
};

function supplySideMayOpenInTender(
  projectType: string | undefined,
  me: MeResponse | null,
): boolean {
  if (projectType === 'design') {
    return isDesignerUser(me);
  }
  return isContractorUser(me);
}

/**
 * Client-side mirror of API open-card ACL.
 * Cards stay visible; navigation should only happen when this returns true.
 */
export function canOpenProjectDetail(
  status: string,
  context: ProjectOpenContext,
): boolean {
  const { me, isOwned = false, isAwardedContractor = false, projectType } =
    context;

  if (isOwned) {
    return true;
  }
  if (me?.roles?.includes('admin')) {
    return true;
  }

  if (CONTRACTOR_OPEN_STATUSES.has(status)) {
    return supplySideMayOpenInTender(projectType, me);
  }

  if (RESTRICTED_OPEN_STATUSES.has(status)) {
    return isAwardedContractor;
  }

  return false;
}

export type ProjectOpenBlockReason =
  | 'login_contractor'
  | 'login_designer'
  | 'contractor_only'
  | 'designer_only'
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
    if (context.projectType === 'design') {
      return context.me ? 'designer_only' : 'login_designer';
    }
    return context.me ? 'contractor_only' : 'login_contractor';
  }

  if (RESTRICTED_OPEN_STATUSES.has(status)) {
    return 'parties_only';
  }

  return 'parties_only';
}
