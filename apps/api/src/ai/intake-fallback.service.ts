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
import {
  narrativeHasPoolDepthFact,
  narrativeHasPumpStationFact,
  shouldAskElectricalScopeQuestions,
  shouldAskPoolLightingQuestions,
  shouldAskPoolScopeQuestions,
  shouldAskPoolWaterTreatmentQuestions,
  shouldAskSanitaryPointsQuestions,
  shouldAskStoreyCount,
  shouldAskUtilityConnectionQuestions,
} from './intake-scope-heuristics';
import {
  fallbackDefaultDescription,
  getFallbackApproxAreaQuestion,
  getFallbackElectricalScopeQuestion,
  getFallbackMaterialsNotesQuestion,
  getFallbackPoolDepthQuestion,
  getFallbackPoolLightingQuestion,
  getFallbackPoolPumpQuestion,
  getFallbackPoolWaterTreatmentQuestion,
  getFallbackPropertyTypeQuestion,
  getFallbackSanitaryPointsQuestion,
  getFallbackSpecialSystemsQuestion,
  getFallbackStoreyCountQuestion,
  getFallbackTimelineQuestion,
  getFallbackUtilityConnectionsQuestion,
} from './intake-fallback-copy';

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
      fallbackDefaultDescription(context.locale, context.title);

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
      return getFallbackPropertyTypeQuestion(context.locale);
    }

    return this.fallbackQuestionQueue(context)[0] ?? null;
  }

  private fallbackQuestionQueue(
    context: ProjectIntakeContext,
  ): IntakeQuestion[] {
    const locale = context.locale;
    const hasDocArea = Boolean(
      context.documents?.some(
        (doc) =>
          doc.summary.match(/\d+\s*(sqm|m2|sq\.?\s*m)/i) ||
          doc.keyFacts?.some((fact) => /\d+\s*(sqm|m2)/i.test(fact)),
      ),
    );

    const queue: IntakeQuestion[] = [];
    if (!hasDocArea) {
      queue.push(getFallbackApproxAreaQuestion(locale));
    }

    const needsBuildingSystemsQuestions = [
      'new_build',
      'extension',
      'commercial_fitout',
    ].includes(context.projectType);
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

    if (shouldAskStoreyCount(context)) {
      queue.push(getFallbackStoreyCountQuestion(locale));
    }

    if (shouldAskUtilityConnectionQuestions(context)) {
      queue.push(getFallbackUtilityConnectionsQuestion(locale));
    }

    if (shouldAskElectricalScopeQuestions(context)) {
      queue.push(getFallbackElectricalScopeQuestion(locale));
    }

    if (shouldAskSanitaryPointsQuestions(context)) {
      queue.push(getFallbackSanitaryPointsQuestion(locale));
    }

    if (shouldAskPoolScopeQuestions(context)) {
      if (!narrativeHasPoolDepthFact(context)) {
        queue.push(getFallbackPoolDepthQuestion(locale));
      }

      if (!narrativeHasPumpStationFact(context)) {
        queue.push(getFallbackPoolPumpQuestion(locale));
      }

      if (shouldAskPoolWaterTreatmentQuestions(context)) {
        queue.push(getFallbackPoolWaterTreatmentQuestion(locale));
      }

      if (shouldAskPoolLightingQuestions(context)) {
        queue.push(getFallbackPoolLightingQuestion(locale));
      }
    } else if (needsBuildingSystemsQuestions && !hasDocSpecialSystems) {
      queue.push(getFallbackSpecialSystemsQuestion(locale));
    }

    queue.push(
      getFallbackTimelineQuestion(locale),
      getFallbackMaterialsNotesQuestion(
        locale,
        hasDocumentIntakeContext(context.documents),
      ),
    );

    return queue;
  }
}
