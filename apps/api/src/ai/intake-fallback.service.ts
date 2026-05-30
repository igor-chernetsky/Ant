import { Injectable } from '@nestjs/common';
import {
  InitialIntakeResult,
  IntakeQuestion,
  NextQuestionResult,
  ProjectIntakeContext,
  FinalIntakeResult,
} from './intake.types';
import { suggestTagSlugsFromText } from '../projects/project-brief';

@Injectable()
export class IntakeFallbackService {
  runInitialIntake(context: ProjectIntakeContext): InitialIntakeResult {
    const narrative = [context.title, context.description ?? ''].join(' ').trim();
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
        currentQuestion: nextQuestion,
        askedQuestionIds: nextQuestion ? [nextQuestion.id] : [],
        provider: 'fallback',
      },
    };
  }

  getNextQuestion(context: ProjectIntakeContext): NextQuestionResult {
    const asked = new Set([
      ...context.answers.map((a) => a.questionId),
      ...(context.improvedDescription ? [] : []),
    ]);

    const queue = this.fallbackQuestionQueue(context);
    const next = queue.find((q) => !asked.has(q.id)) ?? null;

    return { nextQuestion: next };
  }

  finalizeIntake(context: ProjectIntakeContext): FinalIntakeResult {
    const narrative = [
      context.title,
      context.improvedDescription ?? context.description ?? '',
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

    return {
      id: 'upload-plans-info',
      type: 'info',
      prompt:
        'If you have floor plans or photos, upload them in the Documents section below. This helps contractors estimate accurately.',
      required: false,
    };
  }

  private fallbackQuestionQueue(
    context: ProjectIntakeContext,
  ): IntakeQuestion[] {
    return [
      {
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
      },
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
        prompt: 'Any material preferences or constraints? (optional)',
        required: false,
        allowSkip: true,
        placeholder: 'e.g. premium tiles, client-supplied fixtures…',
      },
      {
        id: 'upload-plans-info',
        type: 'info',
        prompt:
          'Upload floor plans or reference photos in the Documents section if available.',
        required: false,
      },
    ];
  }
}
