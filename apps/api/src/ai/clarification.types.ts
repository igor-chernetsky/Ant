export interface ClarificationMergeInput {
  existingQuestions: string[];
  newQuestions: string[];
}

export interface ClarificationMergeResult {
  /** Indices in existingQuestions that received duplicates */
  mergeIntoExisting: Array<{
    existingIndex: number;
    duplicateTexts: string[];
    canonicalText?: string;
  }>;
  /** Truly new questions to append (normalized wording) */
  novelQuestions: string[];
  provider: 'openai' | 'fallback';
}

export interface ClarificationSummaryResult {
  summary: string;
  provider: 'openai' | 'fallback';
}
