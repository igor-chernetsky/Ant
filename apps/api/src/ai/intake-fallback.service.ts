import { Injectable } from '@nestjs/common';
import {
  FinalIntakeResult,
  InitialIntakeResult,
  IntakeQuestion,
  NextQuestionResult,
  ProjectIntakeContext,
} from './intake.types';
import { sanitizeIntakeQuestion } from './intake-question.utils';
import { hasDocumentIntakeContext } from '../intake/intake-document-context';
import { suggestTagSlugsFromText } from '../projects/project-brief';

@Injectable()
export class IntakeFallbackService {
  runInitialIntake(context: ProjectIntakeContext): InitialIntakeResult {
    const documentNarrative =
      context.documents?.map((doc) => doc.summary).join(' ') ?? '';
    const narrative = [context.title, context.description ?? '', documentNarrative]
      .join(' ')
      .trim();
    const tagSlugs = suggestTagSlugsFromText(narrative).filter((slug) =>
      context.availableTagSlugs.includes(slug),
    );

    const improvedDescription =
      context.description?.trim() ||
      `Construction project: ${context.title}. Scope details to be confirmed during intake.`;

    const nextQuestion = this.firstFallbackQuestion(context);

    return {
      improvedDescription,
      tagSlugs,
      confidence: 0.35,
      intake: {
        status: nextQuestion ? 'awaiting_answers' : 'ready_to_submit',
        improvedDescription,
        answers: [],
        currentQuestion: nextQuestion
          ? sanitizeIntakeQuestion(nextQuestion)
          : null,
        askedQuestionIds: nextQuestion ? [nextQuestion.id] : [],
        provider: 'fallback',
      },
    };
  }

  getNextQuestion(context: ProjectIntakeContext): NextQuestionResult {
    const asked = new Set([
      ...context.answers.map((a) => a.questionId),
      ...(context.askedQuestionIds ?? []),
    ]);

    const queue = this.fallbackQuestionQueue(context);
    const next = queue.find((q) => !asked.has(q.id)) ?? null;

    return {
      nextQuestion: next ? sanitizeIntakeQuestion(next) : null,
    };
  }

  finalizeIntake(context: ProjectIntakeContext): FinalIntakeResult {
    const documentNarrative =
      context.documents
        ?.map((doc) => {
          const facts = doc.keyFacts?.length
            ? ` Key facts: ${doc.keyFacts.join('; ')}.`
            : '';
          return `${doc.fileName}: ${doc.summary}.${facts}`;
        })
        .join(' ') ?? '';

    const narrative = [
      context.title,
      context.improvedDescription ?? context.description ?? '',
      documentNarrative,
      ...context.answers.map((a) => {
        if (a.skipped) return '';
        const base = Array.isArray(a.value) ? a.value.join(', ') : a.value;
        if (a.customText) {
          return `${base}: ${a.customText}`;
        }
        return base;
      }),
    ].join(' ');

    const tagSlugs = suggestTagSlugsFromText(narrative).filter((slug) =>
      context.availableTagSlugs.includes(slug),
    );

    const finalDescription =
      context.improvedDescription ??
      context.description ??
      context.title;

    return {
      finalDescription,
      tagSlugs,
      summary: finalDescription.slice(0, 400),
      confidence: 0.4,
    };
  }

  private firstFallbackQuestion(
    context: ProjectIntakeContext,
  ): IntakeQuestion | null {
    if (!context.propertyType) {
      return {
        id: 'property-type',
        type: 'single',
        prompt: 'What type of property is this project for?',
        required: true,
        allowSkip: true,
        allowCustom: true,
        options: [
          { id: 'apartment', label: 'Apartment' },
          { id: 'house', label: 'House' },
          { id: 'commercial', label: 'Commercial' },
          { id: 'land', label: 'Land' },
        ],
      };
    }

    return this.fallbackQuestionQueue(context)[0] ?? null;
  }

  private fallbackQuestionQueue(
    context: ProjectIntakeContext,
  ): IntakeQuestion[] {
    const hasDocArea = Boolean(
      context.documents?.some(
        (doc) =>
          doc.summary.match(/\d+\s*(sqm|m2|sq\.?\s*m)/i) ||
          doc.keyFacts?.some((fact) => /\d+\s*(sqm|m2)/i.test(fact)),
      ),
    );

    const queue: IntakeQuestion[] = [];
    if (!hasDocArea) {
      queue.push({
        id: 'approx-area',
        type: 'single',
        prompt: 'What is the approximate area involved?',
        required: true,
        allowSkip: true,
        allowCustom: true,
        options: [
          { id: 'under-30', label: 'Under 30 sqm' },
          { id: '30-80', label: '30–80 sqm' },
          { id: '80-150', label: '80–150 sqm' },
          { id: '150-plus', label: 'Over 150 sqm' },
        ],
      });
    }

    const needsBuildingSystemsQuestions = [
      'new_build',
      'extension',
      'commercial_fitout',
    ].includes(context.projectType);
    const hasDocStoreys = Boolean(
      context.documents?.some(
        (doc) =>
          /\b(storey|storeys|floor|floors|этаж)\b/i.test(doc.summary) ||
          doc.keyFacts?.some((fact) =>
            /\b(storey|storeys|floor|floors|этаж)\b/i.test(fact),
          ),
      ),
    );
    const hasDocSpecialSystems = Boolean(
      context.documents?.some(
        (doc) =>
          /\b(elevator|lift|pool|basement|подвал|лифт|бассейн)\b/i.test(
            doc.summary,
          ) ||
          doc.keyFacts?.some((fact) =>
            /\b(elevator|lift|pool|basement|подвал|лифт|бассейн)\b/i.test(
              fact,
            ),
          ),
      ),
    );

    if (needsBuildingSystemsQuestions && !hasDocStoreys) {
      queue.push({
        id: 'storey-count',
        type: 'single',
        prompt: 'How many storeys/floors does the building have?',
        required: true,
        allowSkip: true,
        allowCustom: true,
        options: [
          { id: '1', label: 'Single storey' },
          { id: '2', label: '2 storeys' },
          { id: '3-plus', label: '3 or more' },
        ],
      });
    }

    if (needsBuildingSystemsQuestions && !hasDocSpecialSystems) {
      queue.push({
        id: 'special-systems',
        type: 'multi',
        prompt:
          'Which special building systems apply? (select all that apply, or skip if none)',
        required: true,
        allowSkip: true,
        allowCustom: true,
        options: [
          { id: 'none', label: 'None of these' },
          { id: 'elevator', label: 'Elevator / lift' },
          { id: 'pool', label: 'Swimming pool' },
          { id: 'basement', label: 'Basement / underground works' },
          { id: 'smart-home', label: 'Smart home / automation' },
        ],
      });
    }

    queue.push(
      {
        id: 'timeline',
        type: 'single',
        prompt: 'When would you like to start?',
        required: true,
        allowSkip: true,
        allowCustom: true,
        options: [
          { id: 'asap', label: 'As soon as possible' },
          { id: '1-3-months', label: 'In 1–3 months' },
          { id: 'flexible', label: 'Flexible' },
        ],
      },
      {
        id: 'materials-notes',
        type: 'text',
        prompt: hasDocumentIntakeContext(context.documents)
          ? 'Anything missing from the uploaded documents that contractors should know? (optional)'
          : 'Any material preferences or constraints? (optional)',
        required: false,
        allowSkip: true,
        placeholder: 'e.g. premium tiles, client-supplied fixtures…',
      },
    );

    return queue;
  }
}
