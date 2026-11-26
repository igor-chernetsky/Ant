import {
  ProjectType,
  PropertyType,
  TagSource,
} from '@prisma/client';
import { suggestTagSlugsFromText as suggestTagSlugsFromTextImpl } from './project-tag-reconciliation';

export interface ProjectBriefV1 {
  schemaVersion: 1;
  summary?: string;
  packages?: Array<{
    trade: string;
    description: string;
    quantity?: number;
    unit?: string;
    areaSqm?: number;
    sourceDocumentId?: string;
  }>;
  property?: {
    type?: PropertyType;
    areaSqm?: number;
    floors?: number;
    rooms?: number;
  };
  materials?: {
    suppliedBy?: 'client' | 'contractor' | 'mixed';
    tier?: 'economy' | 'standard' | 'premium';
  };
  timeline?: {
    desiredStart?: string;
    flexibility?: 'flexible' | 'fixed';
  };
  design?: {
    hasPlans?: boolean;
    needsDesignTender?: boolean;
  };
  constraints?: string;
  ai?: {
    missingFields?: string[];
    confidence?: number;
    originalNarrative?: string;
    improvedDescription?: string;
    documentInsights?: Array<{
      documentId: string;
      fileName: string;
      analyzedAt: string;
      summary: string;
      confidence: number;
      provider: 'openai' | 'fallback';
      omittedNote?: string;
      keyFacts?: string[];
    }>;
    intake?: {
      status:
        | 'awaiting_answers'
        | 'ready_to_submit'
        | 'processing'
        | 'completed';
      improvedDescription?: string;
      answers: Array<{
        questionId: string;
        value: string | string[];
        skipped?: boolean;
        customText?: string;
        answeredAt: string;
      }>;
      currentQuestion: {
        id: string;
        type: 'single' | 'multi' | 'text' | 'info';
        prompt: string;
        options?: Array<{ id: string; label: string }>;
        required: boolean;
        allowSkip?: boolean;
        allowCustom?: boolean;
        placeholder?: string;
      } | null;
      askedQuestionIds: string[];
      provider: 'openai' | 'fallback';
    };
  };
}

export function slugifyTagLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function buildInitialBrief(input: {
  description?: string | null;
  propertyType?: PropertyType | null;
  originalNarrative?: string;
}): ProjectBriefV1 {
  const missingFields: string[] = [];
  if (!input.description?.trim()) {
    missingFields.push('summary');
  }
  if (!input.propertyType) {
    missingFields.push('property.type');
  }

  return {
    schemaVersion: 1,
    summary: input.description?.trim() ?? '',
    packages: [],
    property: input.propertyType ? { type: input.propertyType } : {},
    materials: {},
    timeline: {},
    design: { hasPlans: false, needsDesignTender: false },
    ai: {
      missingFields,
      confidence: 0.2,
      originalNarrative: input.originalNarrative ?? input.description ?? '',
    },
  };
}

interface ReadinessInput {
  title: string;
  description?: string | null;
  projectType: ProjectType;
  propertyType?: PropertyType | null;
  district?: string | null;
  tagCount: number;
  brief: ProjectBriefV1;
}

/** Checklist keys the sidebar shows as "what is missing". */
export type ReadinessGap =
  | 'description'
  | 'district'
  | 'tags'
  | 'scope'
  | 'intake';

export type ReadinessGapContext = {
  /** An estimate already priced the scope, so "scope details" is no longer a gap. */
  hasEstimate?: boolean;
};

export function describeReadinessGaps(
  input: ReadinessInput,
  context: ReadinessGapContext = {},
): ReadinessGap[] {
  const gaps: ReadinessGap[] = [];
  if (!input.description || input.description.trim().length < 20) {
    gaps.push('description');
  }
  if (!input.district?.trim()) gaps.push('district');
  if (input.tagCount === 0) gaps.push('tags');
  const scopeKnown =
    context.hasEstimate === true || (input.brief.packages?.length ?? 0) > 0;
  if (!scopeKnown) gaps.push('scope');
  if (isIntakeInProgress(input.brief)) gaps.push('intake');
  return gaps;
}

function isIntakeInProgress(brief: ProjectBriefV1): boolean {
  const status = brief.ai?.intake?.status;
  return status === 'awaiting_answers' || status === 'ready_to_submit';
}

export function computeReadinessScore(input: ReadinessInput): number {
  let score = 0;

  if (input.title.trim().length >= 3) score += 15;
  if (input.description && input.description.trim().length >= 20) score += 15;
  if (input.projectType !== ProjectType.other) score += 10;
  if (input.propertyType) score += 10;
  if (input.district?.trim()) score += 10;
  if (input.tagCount >= 1) score += 15;
  if (input.tagCount >= 3) score += 5;
  if (input.brief.summary && input.brief.summary.length >= 30) score += 10;
  if ((input.brief.packages?.length ?? 0) >= 1) score += 10;

  score = Math.min(100, score);

  /**
   * S1: while the intake is running, unanswered questions are the main unknown, yet
   * the checklist alone reported "90% ready" on a project with zero answers. Reserve
   * 30 points for intake progress and scale the rest, so nothing reaches 100% until
   * the questions are answered.
   */
  const intake = input.brief.ai?.intake;
  if (intake && isIntakeInProgress(input.brief)) {
    const answered = intake.answers.filter(
      (answer) => !answer.skipped || String(answer.value ?? '').trim() !== '',
    ).length;
    const asked = Math.max(
      intake.askedQuestionIds?.length ?? answered,
      answered,
      1,
    );
    const progress = Math.min(1, answered / asked);
    score = Math.round(score * 0.7 + progress * 30);
  }

  return Math.max(0, Math.min(100, score));
}

export function suggestTagSlugsFromText(text: string): string[] {
  return suggestTagSlugsFromTextImpl(text);
}

export { ProjectType, PropertyType, TagSource };
