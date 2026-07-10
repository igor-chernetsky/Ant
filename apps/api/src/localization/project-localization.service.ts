import { Injectable } from '@nestjs/common';
import type { IntakeQuestion } from '../ai/intake.types';
import type { ProjectBriefV1 } from '../projects/project-brief';
import type { ProjectResponse } from '../projects/projects.types';
import type { SupportedLocale } from '../users/locale.types';
import { ContentTranslationService } from './content-translation.service';

@Injectable()
export class ProjectLocalizationService {
  constructor(private readonly translations: ContentTranslationService) {}

  async localizeProjectResponse(
    project: ProjectResponse,
    sourceLocale: SupportedLocale,
    targetLocale: SupportedLocale,
  ): Promise<ProjectResponse> {
    if (sourceLocale === targetLocale) {
      return project;
    }

    const projectId = project.id;
    const translate = (fieldKey: string, sourceText: string | null | undefined) =>
      sourceText
        ? this.translations.getOrTranslateText({
            projectId,
            fieldKey,
            sourceText,
            sourceLocale,
            targetLocale,
          })
        : Promise.resolve(sourceText ?? null);

    const description = project.description
      ? await translate('description', project.description)
      : project.description;

    const scopeSummary = await translate('scopeSummary', project.scopeSummary);
    const clarificationSummary = await translate(
      'clarificationSummary',
      project.clarificationSummary,
    );

    let brief = project.brief;
    if (brief) {
      brief = await this.localizeBrief(
        projectId,
        brief,
        sourceLocale,
        targetLocale,
      );
    }

    let estimate = project.estimate;
    if (estimate) {
      const disclaimer = await translate(
        'estimate.disclaimer',
        estimate.disclaimer ?? '',
      );
      const lines = await Promise.all(
        estimate.lines.map((line, index) =>
          line.description
            ? this.translations
                .getOrTranslateText({
                  projectId,
                  fieldKey: `estimate.line.${index}.description`,
                  sourceText: line.description,
                  sourceLocale,
                  targetLocale,
                })
                .then((description) => ({ ...line, description }))
            : Promise.resolve(line),
        ),
      );
      estimate = {
        ...estimate,
        disclaimer: disclaimer ?? estimate.disclaimer,
        lines,
      };
    }

    return {
      ...project,
      description,
      scopeSummary,
      clarificationSummary,
      brief,
      estimate,
    };
  }

  private async localizeBrief(
    projectId: string,
    brief: ProjectBriefV1,
    sourceLocale: SupportedLocale,
    targetLocale: SupportedLocale,
  ): Promise<ProjectBriefV1> {
    const next: ProjectBriefV1 = { ...brief };

    if (brief.summary) {
      next.summary = await this.translations.getOrTranslateText({
        projectId,
        fieldKey: 'brief.summary',
        sourceText: brief.summary,
        sourceLocale,
        targetLocale,
      });
    }

    if (brief.packages?.length) {
      next.packages = await Promise.all(
        brief.packages.map((pkg, index) =>
          pkg.description
            ? this.translations
                .getOrTranslateText({
                  projectId,
                  fieldKey: `brief.package.${index}.description`,
                  sourceText: pkg.description,
                  sourceLocale,
                  targetLocale,
                })
                .then((description) => ({ ...pkg, description }))
            : Promise.resolve(pkg),
        ),
      );
    }

    if (brief.ai) {
      const ai = { ...brief.ai };

      if (ai.improvedDescription) {
        ai.improvedDescription = await this.translations.getOrTranslateText({
          projectId,
          fieldKey: 'brief.ai.improvedDescription',
          sourceText: ai.improvedDescription,
          sourceLocale,
          targetLocale,
        });
      }

      if (ai.documentInsights?.length) {
        ai.documentInsights = await Promise.all(
          ai.documentInsights.map(async (insight) => {
            const summary = await this.translations.getOrTranslateText({
              projectId,
              fieldKey: `insight.${insight.documentId}.summary`,
              sourceText: insight.summary,
              sourceLocale,
              targetLocale,
            });

            let keyFacts = insight.keyFacts;
            if (keyFacts?.length) {
              keyFacts = await Promise.all(
                keyFacts.map((fact, factIndex) =>
                  this.translations.getOrTranslateText({
                    projectId,
                    fieldKey: `insight.${insight.documentId}.keyFact.${factIndex}`,
                    sourceText: fact,
                    sourceLocale,
                    targetLocale,
                  }),
                ),
              );
            }

            const omittedNote = insight.omittedNote
              ? await this.translations.getOrTranslateText({
                  projectId,
                  fieldKey: `insight.${insight.documentId}.omittedNote`,
                  sourceText: insight.omittedNote,
                  sourceLocale,
                  targetLocale,
                })
              : insight.omittedNote;

            return { ...insight, summary, keyFacts, omittedNote };
          }),
        );
      }

      if (ai.intake?.currentQuestion) {
        const question = await this.translations.getOrTranslateJson<IntakeQuestion>(
          {
            projectId,
            fieldKey: `intake.question.${ai.intake.currentQuestion.id}`,
            sourceValue: ai.intake.currentQuestion,
            sourceLocale,
            targetLocale,
          },
        );
        ai.intake = { ...ai.intake, currentQuestion: question };
      }

      next.ai = ai;
    }

    return next;
  }
}
