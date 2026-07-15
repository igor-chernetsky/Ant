/**
 * Guardrails so clarification merges cannot collapse a full project brief
 * into a single micro-answer (e.g. only "need to remove paving tiles").
 */

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(text: string): string[] {
  return normalizeForCompare(text)
    .split(' ')
    .filter((token) => token.length >= 4);
}

/** Rough check that `next` still carries substantial wording from `previous`. */
export function retainsPriorNarrative(
  previous: string,
  next: string,
): boolean {
  const prevTokens = significantTokens(previous);
  if (prevTokens.length < 8) {
    return true;
  }
  const nextSet = new Set(significantTokens(next));
  let hits = 0;
  for (const token of prevTokens) {
    if (nextSet.has(token)) {
      hits += 1;
    }
  }
  return hits / prevTokens.length >= 0.35;
}

export function looksLikeCollapsedScope(
  previous: string | null | undefined,
  next: string | null | undefined,
): boolean {
  const prev = previous?.trim() ?? '';
  const updated = next?.trim() ?? '';
  if (!prev || !updated) {
    return false;
  }
  if (prev.length < 120) {
    return false;
  }
  // Severely shorter than before and missing most prior content.
  if (updated.length < Math.max(80, Math.floor(prev.length * 0.45))) {
    return !retainsPriorNarrative(prev, updated);
  }
  if (!retainsPriorNarrative(prev, updated) && updated.length < prev.length) {
    return true;
  }
  return false;
}

export function preserveMergedDescription(input: {
  previousDescription: string | null | undefined;
  previousSummary?: string | null;
  candidate: string;
  updateBody: string;
}): string {
  const previous =
    input.previousDescription?.trim() ||
    input.previousSummary?.trim() ||
    '';
  const candidate = input.candidate.trim();
  if (!previous) {
    return candidate;
  }
  if (!candidate) {
    return previous;
  }
  if (!looksLikeCollapsedScope(previous, candidate)) {
    return candidate;
  }
  return `${previous}\n\nClarification update:\n${input.updateBody.trim()}`.trim();
}

export function preserveMergedSummary(input: {
  previousSummary: string | null | undefined;
  previousDescription: string | null | undefined;
  candidate: string;
  preservedDescription: string;
}): string {
  const previous =
    input.previousSummary?.trim() ||
    input.previousDescription?.trim() ||
    '';
  const candidate = input.candidate.trim();
  if (!previous) {
    return candidate || input.preservedDescription.slice(0, 400);
  }
  if (!candidate) {
    return previous;
  }
  if (!looksLikeCollapsedScope(previous, candidate)) {
    // Also reject tiny summaries when we still have a long project description.
    if (
      previous.length >= 80 &&
      candidate.length < 50 &&
      input.preservedDescription.length > 160
    ) {
      return previous;
    }
    return candidate;
  }
  return previous;
}

export function preserveMergedScopeSummary(input: {
  previousScopeSummary: string | null | undefined;
  previousDescription: string | null | undefined;
  candidate: string;
  preservedSummary: string;
  preservedDescription: string;
}): string {
  const previous =
    input.previousScopeSummary?.trim() ||
    input.previousDescription?.trim() ||
    '';
  const candidate = input.candidate.trim();
  if (!previous) {
    return (
      candidate ||
      input.preservedSummary ||
      input.preservedDescription.slice(0, 300)
    );
  }
  if (!candidate) {
    return previous;
  }
  if (!looksLikeCollapsedScope(previous, candidate)) {
    if (
      previous.length >= 80 &&
      candidate.length < 50 &&
      input.preservedDescription.length > 160
    ) {
      return previous;
    }
    return candidate;
  }
  return previous;
}
