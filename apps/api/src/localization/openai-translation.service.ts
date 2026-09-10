import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupportedLocale } from '../users/locale.types';
import { localeLanguageName } from './locale.utils';

export function hashSourceText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

const THAI_RE = /[\u0e00-\u0e7f]/;
const CYRILLIC_RE = /[\u0400-\u04ff]/;
const LATIN_RE = /[A-Za-z]/;

/**
 * Rough script check: does the text already look like it is written in the
 * target language? Used to skip the model entirely instead of asking it to
 * "return the text unchanged" (models tend to answer with a comment instead).
 */
export function textLooksLikeLocale(
  text: string,
  locale: SupportedLocale,
): boolean {
  const hasThai = THAI_RE.test(text);
  const hasCyrillic = CYRILLIC_RE.test(text);
  const hasLatin = LATIN_RE.test(text);
  if (locale === 'th') {
    return hasThai && !hasCyrillic;
  }
  if (locale === 'ru') {
    return hasCyrillic && !hasThai;
  }
  return hasLatin && !hasThai && !hasCyrillic;
}

/**
 * Models sometimes answer with a comment ("This text is already in English",
 * "No translation needed") instead of the text itself. Treat that as a failed
 * translation so callers fall back to the original text.
 */
export function isMetaCommentaryTranslation(text: string): boolean {
  const value = text.trim();
  if (!value) {
    return false;
  }
  if (value.length > 300 && !/^["'“]/.test(value)) {
    return false;
  }
  return (
    /^(this|the)\s+(text|content|message)\s+is\s+already\b/i.test(value) ||
    /^already\s+in\s+(english|thai|russian)\b/i.test(value) ||
    /\bno\s+translation\s+(is\s+)?(needed|necessary|required)\b/i.test(value) ||
    /^i\s+(cannot|can't|can not|am unable to)\s+translat/i.test(value) ||
    /^(the\s+)?translation\s+is\s+(the\s+)?same\b/i.test(value)
  );
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
    if (textLooksLikeLocale(text, targetLocale)) {
      return text;
    }

    const fromLang = localeLanguageName(sourceLocale);
    const toLang = localeLanguageName(targetLocale);

    const system = `You translate construction marketplace content from ${fromLang} to ${toLang}.
Rules:
- Preserve numbers, units (sqm, THB), proper nouns, and technical trade names when appropriate
- Keep tone professional and clear
- Output ONLY the translated text. Never add notes, explanations, quotes or commentary about the translation
- If the text is already written in ${toLang}, output it back exactly as received, character for character`;

    return this.completeTranslation(system, text);
  }

  /**
   * Translate user-authored content (Q&A, chat) when the true source locale
   * may differ from the project source locale.
   */
  async translateTextAutoDetect(
    text: string,
    targetLocale: SupportedLocale,
  ): Promise<string | null> {
    if (!this.isConfigured() || !text.trim()) {
      return null;
    }
    // Already in the target language (script-wise) — never ask the model.
    if (textLooksLikeLocale(text, targetLocale)) {
      return text;
    }

    const toLang = localeLanguageName(targetLocale);
    const system = `You translate construction marketplace content to ${toLang}.
Rules:
- Detect the source language automatically
- Output ONLY the translated text. Never add notes, explanations, quotes or commentary about the translation
- If the text is already written in ${toLang}, output it back exactly as received, character for character
- Preserve numbers, units (sqm, THB), proper nouns, and technical trade names when appropriate
- Keep tone professional and clear`;

    return this.completeTranslation(system, text);
  }

  private async completeTranslation(
    system: string,
    text: string,
  ): Promise<string | null> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          max_tokens: 1500,
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
      if (!translated) {
        return null;
      }
      if (isMetaCommentaryTranslation(translated)) {
        this.logger.warn(
          `OpenAI translate returned commentary instead of the text: ${translated.slice(0, 120)}`,
        );
        return null;
      }
      return translated;
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
        signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          max_tokens: 1500,
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
