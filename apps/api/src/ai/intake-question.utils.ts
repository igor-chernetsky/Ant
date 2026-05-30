import { INTAKE_OTHER_OPTION_ID, IntakeQuestion } from './intake.types';

/** Detect AI-generated "Other" options — UI adds a single custom Other control. */
export function isOtherLikeOption(option: { id: string; label: string }): boolean {
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

/** Normalize question flags and strip duplicate Other options from stored/AI payloads. */
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
