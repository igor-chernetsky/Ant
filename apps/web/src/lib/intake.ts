import type { Project } from './projects';

export type IntakeQuestionType = 'single' | 'multi' | 'text' | 'info';

export type IntakeStatus =
  | 'awaiting_answers'
  | 'ready_to_submit'
  | 'processing'
  | 'completed';

export interface IntakeQuestion {
  id: string;
  type: IntakeQuestionType;
  prompt: string;
  options?: Array<{ id: string; label: string }>;
  required: boolean;
  allowSkip?: boolean;
  allowCustom?: boolean;
  placeholder?: string;
}

export const INTAKE_OTHER_OPTION_ID = '__other__';

export function isOtherLikeOption(option: {
  id: string;
  label: string;
}): boolean {
  const id = option.id.toLowerCase().trim();
  const label = option.label.trim();
  const labelLower = label.toLowerCase();

  if (id === INTAKE_OTHER_OPTION_ID || id === '__other__' || id === 'other') {
    return true;
  }
  if (/(^|[-_])other($|[-_])/i.test(id)) {
    return true;
  }

  if (labelLower === 'other') return true;
  if (/^other\b/i.test(label)) return true;
  if (/^other[:\s(,—–-]/i.test(label)) return true;

  return false;
}

export function sanitizeIntakeQuestion(question: IntakeQuestion): IntakeQuestion {
  if (question.type === 'info') {
    return { ...question, required: false, allowSkip: false };
  }

  const sanitized: IntakeQuestion = {
    ...question,
    allowSkip: true,
    allowCustom:
      question.type === 'single' || question.type === 'multi'
        ? true
        : question.allowCustom,
  };

  if (question.type !== 'single' && question.type !== 'multi') {
    return sanitized;
  }

  const options = (question.options ?? []).filter((o) => !isOtherLikeOption(o));
  return { ...sanitized, options };
}

export interface IntakeAnswerPayload {
  questionId: string;
  skipped?: boolean;
  value?: string | string[];
  customText?: string;
}

export function isIntakeActive(project: Project): boolean {
  const intake = project.brief?.ai?.intake;
  if (!intake) return false;
  return intake.status !== 'completed';
}

/** Dynamic intake progress — total is estimated until ready_to_submit. */
export function getIntakeProgress(intake: {
  answers: Array<unknown>;
  askedQuestionIds: string[];
  status: IntakeStatus;
  currentQuestion: IntakeQuestion | null;
}): {
  percent: number;
  label: string;
  answered: number;
  step: number;
  estimatedTotal: number;
  isComplete: boolean;
} {
  const answered = intake.answers.length;
  const onQuestion =
    intake.status === 'awaiting_answers' && intake.currentQuestion != null;

  if (intake.status === 'ready_to_submit') {
    const total = Math.max(answered, 1);
    return {
      percent: 100,
      label: 'All questions answered',
      answered,
      step: total,
      estimatedTotal: total,
      isComplete: true,
    };
  }

  const step = onQuestion ? answered + 1 : Math.max(answered, 1);
  const estimatedTotal = Math.max(
    5,
    intake.askedQuestionIds.length,
    answered + 2,
  );

  const completedRatio = answered / estimatedTotal;
  const inProgressBoost = onQuestion ? 0.08 : 0;
  const percent = Math.round(
    Math.min(92, Math.max(10, (completedRatio + inProgressBoost) * 100)),
  );

  return {
    percent,
    label: onQuestion
      ? `Question ${step} of ~${estimatedTotal}`
      : `${answered} answered`,
    answered,
    step,
    estimatedTotal,
    isComplete: false,
  };
}

export async function submitIntakeAnswer(
  projectId: string,
  payload: IntakeAnswerPayload,
): Promise<Project> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/intake/answer`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to submit answer');
  }
  return response.json() as Promise<Project>;
}

export async function submitIntakeForProcessing(
  projectId: string,
): Promise<Project> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/intake/submit`,
    {
      method: 'POST',
      credentials: 'include',
    },
  );

  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to submit intake');
  }
  return response.json() as Promise<Project>;
}
