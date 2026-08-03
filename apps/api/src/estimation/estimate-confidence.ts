/**
 * Soften only very high ballpark confidence scores.
 * If confidence is above 70%, subtract 5 percentage points.
 */
export function adjustEstimateConfidence(raw: number): number {
  const confidence = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  const adjusted = confidence > 0.7 ? confidence - 0.05 : confidence;
  return Math.round(Math.min(1, Math.max(0, adjusted)) * 1000) / 1000;
}
