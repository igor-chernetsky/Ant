import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FinalIntakeResult,
  InitialIntakeResult,
  IntakeQuestion,
  NextQuestionResult,
  ProjectIntakeContext,
} from './intake.types';

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

  private questionSchemaHint(): string {
    return `Question object schema:
{
  "id": "kebab-case unique id",
  "type": "single" | "multi" | "text" | "info",
  "prompt": "question text in English",
  "options": [{ "id": "opt-id", "label": "label" }],
  "required": true|false,
  "placeholder": "optional hint for text"
}
- "single": radio buttons (options required, 2-6 options)
- "multi": checkboxes (options required)
- "text": free text (no options)
- "info": informational only, no answer needed (required=false). Use for reminders like uploading floor plans.`;
  }

  async runInitialIntake(
    context: ProjectIntakeContext,
  ): Promise<InitialIntakeResult | null> {
    const system = `You are a construction marketplace intake assistant. Improve project descriptions and suggest scope tags.
Return JSON only with keys: improvedDescription, tagSlugs, confidence, nextQuestion.
${this.questionSchemaHint()}
Rules:
- improvedDescription: clear professional English, 2-5 sentences, do not invent facts not implied by input
- tagSlugs: subset of allowed tags only
- confidence: 0-1
- nextQuestion: first follow-up question to clarify scope, or null if nothing needed
- Ask at most ONE question in nextQuestion
- Prefer practical construction questions (area, timeline, materials, plans)`;

    const user = JSON.stringify({
      title: context.title,
      description: context.description,
      projectType: context.projectType,
      propertyType: context.propertyType,
      district: context.district,
      allowedTagSlugs: context.availableTagSlugs,
    });

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
        currentQuestion: nextQuestion,
        askedQuestionIds: nextQuestion ? [nextQuestion.id] : [],
        provider: 'openai',
      },
    };
  }

  async getNextQuestion(
    context: ProjectIntakeContext,
    lastAnswer: { questionId: string; value: string | string[] },
  ): Promise<NextQuestionResult | null> {
    const system = `You continue a construction project intake interview one question at a time.
Return JSON: { "nextQuestion": Question|null, "improvedDescription": string optional }.
${this.questionSchemaHint()}
Rules:
- Return exactly ONE next question or null when intake is complete
- Do not repeat question ids already asked: ${JSON.stringify(context.answers.map((a) => a.questionId))}
- Use "info" type to suggest uploading plans/photos when relevant and not yet mentioned
- Adapt next question based on previous answers
- improvedDescription: optionally refine project description with new facts from answers`;

    const user = JSON.stringify({
      project: {
        title: context.title,
        projectType: context.projectType,
        propertyType: context.propertyType,
        district: context.district,
        improvedDescription: context.improvedDescription,
      },
      answers: context.answers,
      lastAnswer,
      allowedTagSlugs: context.availableTagSlugs,
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
    const system = `You finalize a construction project intake.
Return JSON: { "finalDescription", "tagSlugs", "summary", "confidence" }.
Rules:
- finalDescription: polished scope description for contractors (English)
- summary: shorter version for brief (1-3 sentences)
- tagSlugs: from allowed list only
- confidence: 0-1`;

    const user = JSON.stringify({
      project: {
        title: context.title,
        projectType: context.projectType,
        propertyType: context.propertyType,
        district: context.district,
      },
      improvedDescription: context.improvedDescription,
      answers: context.answers,
      allowedTagSlugs: context.availableTagSlugs,
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
    if (!['single', 'multi', 'text', 'info'].includes(type)) {
      return null;
    }

    const options =
      type === 'single' || type === 'multi'
        ? (q.options ?? [])
            .filter(
              (o): o is { id: string; label: string } =>
                !!o?.id && !!o?.label,
            )
            .slice(0, 8)
        : undefined;

    if ((type === 'single' || type === 'multi') && (!options || options.length < 2)) {
      return null;
    }

    return {
      id: String(q.id).slice(0, 64),
      type,
      prompt: String(q.prompt).slice(0, 500),
      options,
      required: type === 'info' ? false : q.required !== false,
      placeholder: q.placeholder?.slice(0, 200),
    };
  }
}
