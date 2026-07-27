import {
  isAdminUser,
  isContractorUser,
  isDesignerUser,
  type MeResponse,
} from '@/lib/session';

const CONTRACTOR_OPEN_STATUSES = new Set(['clarification', 'in_tender']);
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

function hasRegisteredSupplyProfile(
  me: MeResponse | null,
  kind: 'contractor' | 'designer',
): boolean {
  if (!me?.companyName?.trim()) {
    return false;
  }
  return kind === 'designer' ? isDesignerUser(me) : isContractorUser(me);
}

function supplySideMayOpenInTender(
  projectType: string | undefined,
  me: MeResponse | null,
): boolean {
  if (projectType === 'design') {
    return hasRegisteredSupplyProfile(me, 'designer');
  }
  return hasRegisteredSupplyProfile(me, 'contractor');
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
  if (isAdminUser(me)) {
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
