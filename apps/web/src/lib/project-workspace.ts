/**
 * Visibility and mutability of the signed-project workspace: the contract
 * (with its additional agreements), progress claims and defect claims.
 *
 * Both parties keep read access after the project is completed so the contract
 * and the claim history stay available as a record; every action is limited to
 * an active project and is enforced again by the API.
 */

const CONTRACT_STATUSES = new Set(['awarded', 'active', 'completed']);
const CLAIMS_STATUSES = new Set(['active', 'completed']);

/** The contract card is shown from award until the project is completed. */
export function isContractProjectStatus(status: string): boolean {
  return CONTRACT_STATUSES.has(status);
}

/** Progress and defect claim panels are shown while active and after completion. */
export function isClaimsProjectStatus(status: string): boolean {
  return CLAIMS_STATUSES.has(status);
}

/**
 * True when the workspace is history only: the panels render without their
 * action buttons and the API rejects mutations.
 */
export function isProjectWorkspaceReadOnly(status: string): boolean {
  return status !== 'active';
}
