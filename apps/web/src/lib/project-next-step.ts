/**
 * "What should the client do next?" for the project page.
 *
 * The page shows documents, intake questions, the estimate and the tender as
 * separate cards, so a first-time client had no single answer to "what now". This
 * resolver turns the project state into one next step, and the banner links to the
 * card that performs it.
 */

export type ProjectNextStepKey =
  | 'signup'
  | 'intake'
  | 'estimate'
  | 'publish'
  | 'waiting'
  | 'contract';

export interface ProjectNextStepInput {
  /** Project status from the API (`draft`, `intake`, `estimated`, …). */
  status: string;
  /** Whether `brief.ai.intake.status === 'completed'`. */
  intakeCompleted: boolean;
  hasEstimate: boolean;
  /** Owner (client, guest owner or admin acting as the client). */
  isOwner: boolean;
  /** Guest owner of an unclaimed draft: publishing needs an account. */
  isGuestOwner: boolean;
}

export interface ProjectNextStep {
  key: ProjectNextStepKey;
  /** Element the CTA scrolls to; `null` when the step opens a modal instead. */
  targetId: string | null;
  /** Position in the four client steps, for "Step 2 of 4". */
  step: number;
  total: number;
}

const TOTAL_STEPS = 4;

const TENDER_STATUSES = new Set(['in_tender', 'clarification', 'pending']);
const CONTRACT_STATUSES = new Set(['awarded', 'active']);

/**
 * Ordered checks: the first matching state wins.
 *
 * `null` means "nothing to prompt" — a contractor viewing the project, a finished
 * project, or a project the caller cannot manage.
 */
export function resolveProjectNextStep(
  input: ProjectNextStepInput,
): ProjectNextStep | null {
  const { status, intakeCompleted, hasEstimate, isOwner, isGuestOwner } = input;

  if (!isOwner || status === 'completed') {
    return null;
  }

  if (CONTRACT_STATUSES.has(status)) {
    return { key: 'contract', targetId: 'project-contract', step: 4, total: TOTAL_STEPS };
  }

  if (TENDER_STATUSES.has(status)) {
    return { key: 'waiting', targetId: 'project-tender', step: 4, total: TOTAL_STEPS };
  }

  if (isGuestOwner) {
    return { key: 'signup', targetId: null, step: 1, total: TOTAL_STEPS };
  }

  if (hasEstimate || status === 'estimated') {
    return { key: 'publish', targetId: 'project-tender', step: 3, total: TOTAL_STEPS };
  }

  if (!intakeCompleted || status === 'draft' || status === 'intake') {
    return { key: 'intake', targetId: 'project-intake', step: 1, total: TOTAL_STEPS };
  }

  return { key: 'estimate', targetId: 'project-intake', step: 2, total: TOTAL_STEPS };
}
