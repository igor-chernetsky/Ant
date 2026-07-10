import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from '../users/locale.types';
import {
  FinalIntakeResult,
  InitialIntakeResult,
  IntakeQuestion,
  NextQuestionResult,
  ProjectIntakeContext,
} from './intake.types';
import {
  isOtherLikeOption,
  sanitizeIntakeQuestion,
} from './intake-question.utils';
import { localeLanguageName } from '../localization/locale.utils';

@Injectable()
export class OpenAiIntakeService {
  private readonly logger = new Logger(OpenAiIntakeService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async chatJson<T>(system: string, user: string): Promise<T | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`OpenAI HTTP ${response.status}: ${text.slice(0, 200)}`);
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        return null;
      }

      return JSON.parse(content) as T;
    } catch (err) {
      this.logger.warn(
        `OpenAI call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private outputLanguage(context: ProjectIntakeContext): string {
    const locale = context.locale;
    if (locale && isSupportedLocale(locale)) {
      return localeLanguageName(locale);
    }
    return localeLanguageName(DEFAULT_LOCALE);
  }

  private questionSchemaHint(context: ProjectIntakeContext): string {
    const lang = this.outputLanguage(context);
    return `Question object schema:
{
  "id": "kebab-case unique id",
  "type": "single" | "multi" | "text",
  "prompt": "question text in ${lang}",
  "options": [{ "id": "opt-id", "label": "label in ${lang}" }],
  "required": true|false,
  "allowSkip": true (always — user may skip any non-info question),
  "allowCustom": true (always for single/multi — do NOT add an "Other" option; the UI provides it),
  "placeholder": "optional hint for text in ${lang}"
}
- "single": radio buttons (options required)
- options: 2-6 concrete choices only — never include "Other", "Custom", or free-text options
- "text": free text (no options)
- Never use "info" type. Never ask the user to upload plans, photos, or documents — the UI shows a static reminder instead.`;
  }

  private documentContextRules(): string {
    return `When uploadedDocuments is non-empty:
- Treat summaries, keyFacts, and scopeLines as facts already known about the project
- keyFacts may include room dimensions, areas, storey counts, and materials — use them in improvedDescription and to avoid redundant questions
- Do not ask questions that those documents already answer clearly
- Ask follow-ups only for gaps, ambiguities, or missing scope/timeline/material details
- You may weave document facts into improvedDescription when relevant`;
  }

  private serializeContextForPrompt(context: ProjectIntakeContext) {
    return {
      title: context.title,
      description: context.description,
      projectType: context.projectType,
      propertyType: context.propertyType,
      district: context.district,
      improvedDescription: context.improvedDescription,
      allowedTagSlugs: context.availableTagSlugs,
      uploadedDocuments: context.documents ?? [],
    };
  }

  async runInitialIntake(
    context: ProjectIntakeContext,
  ): Promise<InitialIntakeResult | null> {
    const lang = this.outputLanguage(context);
    const system = `You are a construction marketplace intake assistant. Improve project descriptions and suggest scope tags.
Return JSON only with keys: improvedDescription, tagSlugs, confidence, nextQuestion.
${this.questionSchemaHint(context)}
Rules:
- improvedDescription: clear professional ${lang}, 2-5 sentences, do not invent facts not implied by input or uploadedDocuments
- tagSlugs: subset of allowed tags only
- confidence: 0-1
- nextQuestion: first follow-up question to clarify scope, or null if nothing needed
- Ask at most ONE question in nextQuestion
- Prefer practical construction questions (area, timeline, materials)
${this.documentContextRules()}`;

    const user = JSON.stringify(this.serializeContextForPrompt(context));

    const result = await this.chatJson<{
      improvedDescription?: string;
      tagSlugs?: string[];
      confidence?: number;
      nextQuestion?: IntakeQuestion | null;
    }>(system, user);

    if (!result?.improvedDescription) {
      return null;
    }

    const nextQuestion = this.normalizeQuestion(result.nextQuestion);
    const status = nextQuestion ? 'awaiting_answers' : 'ready_to_submit';

    return {
      improvedDescription: result.improvedDescription.trim(),
      tagSlugs: Array.isArray(result.tagSlugs) ? result.tagSlugs : [],
      confidence:
        typeof result.confidence === 'number'
          ? Math.min(1, Math.max(0, result.confidence))
          : 0.5,
      intake: {
        status,
        improvedDescription: result.improvedDescription.trim(),
        answers: [],
        currentQuestion: nextQuestion
          ? sanitizeIntakeQuestion(nextQuestion)
          : null,
        askedQuestionIds: nextQuestion ? [nextQuestion.id] : [],
        provider: 'openai',
      },
    };
  }

  async getNextQuestion(
    context: ProjectIntakeContext,
    lastAnswer: {
      questionId: string;
      value: string | string[];
      skipped?: boolean;
      customText?: string;
    },
  ): Promise<NextQuestionResult | null> {
    const system = `You continue a construction project intake interview one question at a time.
Return JSON: { "nextQuestion": Question|null, "improvedDescription": string optional }.
${this.questionSchemaHint(context)}
Rules:
- Return exactly ONE next question or null when intake is complete
- Do not repeat question ids already asked: ${JSON.stringify(context.askedQuestionIds ?? context.answers.map((a) => a.questionId))}
- Never ask about uploading plans, photos, or documents
- Adapt next question based on previous answers and uploadedDocuments
- improvedDescription: optionally refine project description with new facts from answers or documents
${this.documentContextRules()}`;

    const user = JSON.stringify({
      project: this.serializeContextForPrompt(context),
      answers: context.answers,
      lastAnswer,
    });

    const result = await this.chatJson<{
      nextQuestion?: IntakeQuestion | null;
      improvedDescription?: string;
    }>(system, user);

    if (!result) {
      return null;
    }

    return {
      nextQuestion: this.normalizeQuestion(result.nextQuestion),
      improvedDescription: result.improvedDescription?.trim(),
    };
  }

  async finalizeIntake(
    context: ProjectIntakeContext,
  ): Promise<FinalIntakeResult | null> {
    const lang = this.outputLanguage(context);
    const system = `You finalize a construction project intake.
Return JSON: { "finalDescription", "tagSlugs", "summary", "confidence" }.
Rules:
- finalDescription: polished scope description for contractors (${lang})
- summary: shorter version for brief (1-3 sentences, ${lang})
- tagSlugs: from allowed list only
- confidence: 0-1
- Incorporate uploadedDocuments when present; do not contradict them
${this.documentContextRules()}`;

    const user = JSON.stringify({
      project: this.serializeContextForPrompt(context),
      answers: context.answers,
    });

    const result = await this.chatJson<{
      finalDescription?: string;
      tagSlugs?: string[];
      summary?: string;
      confidence?: number;
    }>(system, user);

    if (!result?.finalDescription) {
      return null;
    }

    return {
      finalDescription: result.finalDescription.trim(),
      tagSlugs: Array.isArray(result.tagSlugs) ? result.tagSlugs : [],
      summary: (result.summary ?? result.finalDescription).trim(),
      confidence:
        typeof result.confidence === 'number'
          ? Math.min(1, Math.max(0, result.confidence))
          : 0.7,
    };
  }

  private normalizeQuestion(raw: unknown): IntakeQuestion | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const q = raw as Partial<IntakeQuestion>;
    if (!q.id || !q.type || !q.prompt) {
      return null;
    }

    const type = q.type;
    if (!['single', 'multi', 'text'].includes(type)) {
      return null;
    }

    const options =
      type === 'single' || type === 'multi'
        ? (q.options ?? [])
            .filter(
              (o): o is { id: string; label: string } =>
                !!o?.id && !!o?.label,
            )
            .filter((o) => !isOtherLikeOption(o))
            .slice(0, 8)
        : undefined;

    if ((type === 'single' || type === 'multi') && (!options || options.length < 1)) {
      return null;
    }

    return sanitizeIntakeQuestion({
      id: String(q.id).slice(0, 64),
      type,
      prompt: String(q.prompt).slice(0, 500),
      options,
      required: q.required === true,
      allowSkip: true,
      allowCustom: type === 'single' || type === 'multi',
      placeholder: q.placeholder?.slice(0, 200),
    });
  }
}
