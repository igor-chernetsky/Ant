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
  placeholder?: string;
}

export interface IntakeAnswerPayload {
  questionId: string;
  value?: string | string[];
}

export function isIntakeActive(project: Project): boolean {
  const intake = project.brief?.ai?.intake;
  if (!intake) return false;
  return intake.status !== 'completed';
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
