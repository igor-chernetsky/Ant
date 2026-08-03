/**
 * Ballpark estimates are inherently uncertain — never present near-certainty.
 */
export const BALLPARK_CONFIDENCE_CEILING = 0.72;

export interface EstimateConfidenceContext {
  /** Remaining unanswered improvement questions after dedupe. */
  openImprovementQuestions?: number;
  packageCount?: number;
  descriptionLength?: number;
  /** False when GFA/area is missing or only a weak default. */
  hasReliableArea?: boolean;
  refinementAnswerCount?: number;
}

function applyDataCeilings(
  confidence: number,
  context: EstimateConfidenceContext,
): number {
  let next = confidence;
  const openQs = context.openImprovementQuestions ?? 0;
  if (openQs >= 3) {
    next = Math.min(next, 0.48);
  } else if (openQs >= 2) {
    next = Math.min(next, 0.55);
  } else if (openQs >= 1) {
    next = Math.min(next, 0.62);
  }

  const packages = context.packageCount ?? 0;
  const descLen = context.descriptionLength ?? 0;
  if (packages < 2 && descLen < 80) {
    next = Math.min(next, 0.52);
  } else if (packages < 3 && descLen < 140) {
    next = Math.min(next, 0.6);
  }

  if (context.hasReliableArea === false) {
    next = Math.min(next, 0.55);
  }

  const refinements = context.refinementAnswerCount ?? 0;
  if (refinements === 0 && openQs > 0) {
    next = Math.min(next, 0.58);
  }

  return next;
}

/**
 * Calibrate model/fallback confidence before persistence.
 * Caps optimistic scores and pulls down further when scope data is thin.
 */
export function calibrateEstimateConfidence(
  raw: number,
  context: EstimateConfidenceContext = {},
): number {
  let confidence = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.45;

  // Soft dampen: 0.95 → ~0.81 before ceilings; 0.80 → ~0.70.
  confidence = 0.12 + confidence * 0.73;
  confidence = Math.min(confidence, BALLPARK_CONFIDENCE_CEILING);
  confidence = applyDataCeilings(confidence, context);

  return Math.round(confidence * 1000) / 1000;
}

/**
 * Present stored confidence for API/UI without double-dampening.
 * Still enforces ceiling and open-question caps (incl. legacy 90%+ rows).
 */
export function presentEstimateConfidence(
  raw: number,
  context: EstimateConfidenceContext = {},
): number {
  let confidence = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  confidence = Math.min(confidence, BALLPARK_CONFIDENCE_CEILING);
  confidence = applyDataCeilings(confidence, context);
  return Math.round(confidence * 1000) / 1000;
}

/** Display-only guard for legacy high scores already stored in the DB. */
export function displayEstimateConfidence(raw: number): number {
  return presentEstimateConfidence(raw);
}
