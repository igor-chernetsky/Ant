import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupportedLocale } from '../users/locale.types';
import { localeLanguageName } from './locale.utils';

export function hashSourceText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

@Injectable()
export class OpenAiTranslationService {
  private readonly logger = new Logger(OpenAiTranslationService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async translateText(
    text: string,
    sourceLocale: SupportedLocale,
    targetLocale: SupportedLocale,
  ): Promise<string | null> {
    if (!this.isConfigured() || !text.trim()) {
      return null;
    }
    if (sourceLocale === targetLocale) {
      return text;
    }

    const fromLang = localeLanguageName(sourceLocale);
    const toLang = localeLanguageName(targetLocale);

    const system = `You translate construction marketplace content from ${fromLang} to ${toLang}.
Rules:
- Preserve numbers, units (sqm, THB), proper nouns, and technical trade names when appropriate
- Keep tone professional and clear
- Return only the translated text with no quotes or commentary`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: text },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(
          `OpenAI translate HTTP ${response.status}: ${body.slice(0, 200)}`,
        );
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const translated = payload.choices?.[0]?.message?.content?.trim();
      return translated || null;
    } catch (err) {
      this.logger.warn(
        `OpenAI translate failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async translateJson<T>(
    value: T,
    sourceLocale: SupportedLocale,
    targetLocale: SupportedLocale,
  ): Promise<T | null> {
    if (!this.isConfigured()) {
      return null;
    }
    if (sourceLocale === targetLocale) {
      return value;
    }

    const fromLang = localeLanguageName(sourceLocale);
    const toLang = localeLanguageName(targetLocale);
    const serialized = JSON.stringify(value);

    const system = `Translate all user-facing string values in this JSON from ${fromLang} to ${toLang}.
Keep JSON keys, ids, and structure unchanged. Do not translate slug/id fields or enum-like codes.
Return valid JSON only.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: serialized },
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
      return JSON.parse(content) as T;
    } catch (err) {
      this.logger.warn(
        `OpenAI JSON translate failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
