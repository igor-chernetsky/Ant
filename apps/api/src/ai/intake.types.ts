export type IntakeQuestionType = 'single' | 'multi' | 'text' | 'info';

export type IntakeStatus =
  | 'awaiting_answers'
  | 'ready_to_submit'
  | 'processing'
  | 'completed';

export interface IntakeQuestionOption {
  id: string;
  label: string;
}

export interface IntakeQuestion {
  id: string;
  type: IntakeQuestionType;
  prompt: string;
  options?: IntakeQuestionOption[];
  required: boolean;
  allowSkip?: boolean;
  allowCustom?: boolean;
  placeholder?: string;
}

export interface IntakeAnswer {
  questionId: string;
  value: string | string[];
  skipped?: boolean;
  customText?: string;
  answeredAt: string;
}

export interface IntakeState {
  status: IntakeStatus;
  improvedDescription?: string;
  answers: IntakeAnswer[];
  currentQuestion: IntakeQuestion | null;
  askedQuestionIds: string[];
  provider: 'openai' | 'fallback';
}

export interface InitialIntakeResult {
  improvedDescription: string;
  tagSlugs: string[];
  confidence: number;
  intake: IntakeState;
}

export interface NextQuestionResult {
  nextQuestion: IntakeQuestion | null;
  improvedDescription?: string;
}

export interface FinalIntakeResult {
  finalDescription: string;
  tagSlugs: string[];
  summary: string;
  confidence: number;
}

export interface SubmitAnswerDto {
  questionId: string;
  skipped?: boolean;
  value?: string | string[];
  customText?: string;
}

/** Reserved option id — user supplies customText */
export const INTAKE_OTHER_OPTION_ID = '__other__';

export interface ProjectIntakeContext {
  title: string;
  description: string | null;
  projectType: string;
  propertyType: string | null;
  district: string | null;
  improvedDescription?: string;
  answers: IntakeAnswer[];
  availableTagSlugs: string[];
}
