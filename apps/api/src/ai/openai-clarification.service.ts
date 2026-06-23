import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClarificationMergeInput,
  ClarificationMergeResult,
  ClarificationSummaryResult,
} from './clarification.types';

@Injectable()
export class OpenAiClarificationService {
  private readonly logger = new Logger(OpenAiClarificationService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async mergeQuestions(
    input: ClarificationMergeInput,
  ): Promise<ClarificationMergeResult | null> {
    if (!this.isConfigured() || input.newQuestions.length === 0) {
      return null;
    }

    const system = `You deduplicate contractor clarification questions for a construction tender.
Return JSON only with keys: mergeIntoExisting, novelQuestions.

mergeIntoExisting: array of { existingIndex (0-based into existing list), duplicateTexts (subset of NEW questions that mean the same) }
novelQuestions: NEW questions that are not duplicates of any existing or each other

Rules — be CONSERVATIVE:
- Merge only when two questions clearly ask for the same information (same topic AND same intent).
- Do NOT merge related but distinct questions (e.g. "parking access" vs "loading zone hours").
- Do NOT merge questions that differ in specificity (general vs detailed).
- When unsure, put the question in novelQuestions.
- Each new question must appear exactly once: either in one duplicateTexts array or in novelQuestions.
- Write in English.`;

    const user = JSON.stringify({
      existingQuestions: input.existingQuestions,
      newQuestions: input.newQuestions,
    });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.1,
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

      const parsed = JSON.parse(content) as {
        mergeIntoExisting?: Array<{
          existingIndex?: number;
          duplicateTexts?: string[];
        }>;
        novelQuestions?: string[];
      };

      return {
        mergeIntoExisting: (parsed.mergeIntoExisting ?? [])
          .filter(
            (item) =>
              typeof item.existingIndex === 'number' &&
              item.existingIndex >= 0 &&
              item.existingIndex < input.existingQuestions.length &&
              Array.isArray(item.duplicateTexts),
          )
          .map((item) => ({
            existingIndex: item.existingIndex as number,
            duplicateTexts: (item.duplicateTexts ?? []).filter(
              (text): text is string => typeof text === 'string' && text.trim().length > 0,
            ),
          })),
        novelQuestions: (parsed.novelQuestions ?? []).filter(
          (text): text is string => typeof text === 'string' && text.trim().length > 0,
        ),
        provider: 'openai',
      };
    } catch (err) {
      this.logger.warn(
        `OpenAI clarification merge failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async summarizeAnswers(
    projectTitle: string,
    items: Array<{ question: string; answer: string }>,
  ): Promise<ClarificationSummaryResult | null> {
    if (!this.isConfigured() || items.length === 0) {
      return null;
    }

    const system = `You write a concise supplementary project description for contractors based on Q&A clarifications.
Return JSON only with key: summary (string, 2-8 sentences, factual, English).
Integrate answers into flowing prose suitable for a tender document appendix.
Do not invent facts beyond the provided answers.`;

    const user = JSON.stringify({
      projectTitle,
      clarifications: items,
    });

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
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content) as { summary?: string };
      if (!parsed.summary?.trim()) {
        return null;
      }

      return { summary: parsed.summary.trim(), provider: 'openai' };
    } catch {
      return null;
    }
  }
}
