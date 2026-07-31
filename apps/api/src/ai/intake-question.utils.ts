import { INTAKE_OTHER_OPTION_ID, IntakeQuestion, ProjectIntakeContext } from './intake.types';
import {
  BUILDING_SHELL_INTAKE_QUESTION_IDS,
  isLandscapingOrCivilAmenityOnly,
  POOL_INTAKE_QUESTION_IDS,
  projectMentionsPool,
} from './intake-scope-heuristics';

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

const POOL_INTAKE_QUESTION_ID_SET = new Set<string>(POOL_INTAKE_QUESTION_IDS);
const BUILDING_SHELL_INTAKE_QUESTION_ID_SET = new Set<string>(
  BUILDING_SHELL_INTAKE_QUESTION_IDS,
);

const POOL_PROMPT_PATTERN =
  /\b(pool|swimming\s*pool|бассейн|สระว่ายน้ำ|สระน้ำ|underwater\s*light|подводн.*свет)\b/i;

const BUILDING_SHELL_PROMPT_PATTERN =
  /\b(storey|storeys|floors?|этаж|ชั้น|sanitary|wet\s*points?|сантех|foundation\s*type|фундамент|elevator|lift|лифт|basement|подвал|smart\s*home|умн.*дом)\b/i;

/**
 * Drop or trim questions that do not match project scope
 * (pool FAQs without a pool; building-shell FAQs on landscaping/civil amenity jobs).
 */
export function filterIntakeQuestionForScope(
  context: ProjectIntakeContext,
  question: IntakeQuestion | null,
): IntakeQuestion | null {
  if (!question) {
    return null;
  }

  if (!projectMentionsPool(context)) {
    if (POOL_INTAKE_QUESTION_ID_SET.has(question.id)) {
      return null;
    }
    if (question.id === 'special-systems' && question.type === 'multi') {
      const options = (question.options ?? []).filter(
        (option) => option.id !== 'pool',
      );
      if (options.length < 1) {
        return null;
      }
      question = { ...question, options };
    }
    if (POOL_PROMPT_PATTERN.test(question.prompt)) {
      return null;
    }
  }

  if (isLandscapingOrCivilAmenityOnly(context)) {
    if (BUILDING_SHELL_INTAKE_QUESTION_ID_SET.has(question.id)) {
      return null;
    }
    if (BUILDING_SHELL_PROMPT_PATTERN.test(question.prompt)) {
      return null;
    }
  }

  return question;
}
