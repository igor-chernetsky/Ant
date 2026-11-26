/**
 * One source of truth for the project stage rail.
 *
 * The rail in the header has five stages, while the "next step" banner used to say
 * "Step 1 of 4" — so the same page showed two different step numbers, and after the
 * estimate it jumped from 1 to 3. Everything that needs a stage number reads it here.
 */

export const PROJECT_STAGES = [
  { id: 'setup', statuses: ['draft', 'intake', 'ready_for_estimate'] },
  { id: 'estimate', statuses: ['estimated'] },
  { id: 'tender', statuses: ['clarification', 'in_tender'] },
  { id: 'award', statuses: ['awarded'] },
  { id: 'delivery', statuses: ['active', 'completed'] },
] as const;

export type ProjectStageId = (typeof PROJECT_STAGES)[number]['id'];

/** 0-based stage index for a project status (unknown statuses fall back to `setup`). */
export function projectStageIndex(status: string): number {
  const index = PROJECT_STAGES.findIndex((stage) =>
    (stage.statuses as readonly string[]).includes(status),
  );
  return index >= 0 ? index : 0;
}

/** 1-based position for "Stage 2 of 5" labels. */
export function projectStageNumber(status: string): number {
  return projectStageIndex(status) + 1;
}

export const PROJECT_STAGE_TOTAL = PROJECT_STAGES.length;

/**
 * H6: each stage points at the card that fulfils it, so the rail is a navigation
 * control instead of decoration.
 */
export const PROJECT_STAGE_ANCHORS: Record<ProjectStageId, string> = {
  setup: 'project-intake',
  estimate: 'project-estimate',
  tender: 'project-tender',
  award: 'project-contract',
  delivery: 'project-documents',
};
