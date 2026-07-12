import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { localeLanguageName } from '../localization/locale.utils';
import { DEFAULT_LOCALE, isSupportedLocale } from '../users/locale.types';
import { ScopeSyncContext, ScopeSyncResult } from '../projects/scope-sync.types';

@Injectable()
export class OpenAiScopeSyncService {
  private readonly logger = new Logger(OpenAiScopeSyncService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async processScopeUpdate(
    context: ScopeSyncContext,
  ): Promise<ScopeSyncResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const language = isSupportedLocale(context.locale)
      ? localeLanguageName(context.locale)
      : localeLanguageName(DEFAULT_LOCALE);

    const system = `You are a construction marketplace assistant. The client clarified scope while tendering.
Merge the new clarification into the project understanding. Return JSON only with keys:
applyToProjectScope, updatedDescription, updatedSummary, updatedScopeSummary, tagSlugs, confidence, briefPatches.

Rules:
- applyToProjectScope: for clarification_answer and clarification_attachment always true unless the update is empty noise.
- applyToProjectScope: for client_chat true ONLY when the message adds scope, exclusions, materials, timeline, access, or other facts contractors need in the project summary. False for greetings, scheduling chit-chat, or bid negotiation without scope facts.
- Keep existing factual content; integrate clarifications clearly.
- updatedDescription: full contractor-facing narrative (2-8 sentences).
- updatedSummary: shorter headline summary (1-3 sentences).
- updatedScopeSummary: concise scope-of-works line for commercial proposals (1-3 sentences).
- tagSlugs: subset of allowed tags only.
- confidence: 0-1.
- briefPatches may include constraints, property, timeline, materials when relevant.
- Write updatedDescription, updatedSummary, and updatedScopeSummary in ${language}.`;

    const user = JSON.stringify({
      project: {
        title: context.title,
        description: context.description,
        scopeSummary: context.scopeSummary,
        projectType: context.projectType,
        propertyType: context.propertyType,
        district: context.district,
      },
      brief: context.brief,
      update: context.update,
      allowedTagSlugs: context.availableTagSlugs,
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
        applyToProjectScope?: boolean;
        updatedDescription?: string;
        updatedSummary?: string;
        updatedScopeSummary?: string;
        tagSlugs?: string[];
        confidence?: number;
        briefPatches?: ScopeSyncResult['briefPatches'];
      };

      if (parsed.applyToProjectScope === false) {
        return {
          applied: false,
          updatedDescription: context.description?.trim() || context.title,
          updatedSummary:
            context.brief.summary?.trim() ||
            context.description?.trim() ||
            context.title,
          updatedScopeSummary:
            context.scopeSummary?.trim() ||
            context.description?.trim() ||
            context.title,
          tagSlugs: [],
          confidence: 0,
          provider: 'openai',
        };
      }

      const allowed = new Set(context.availableTagSlugs);
      const tagSlugs = [
        ...new Set((parsed.tagSlugs ?? []).filter((slug) => allowed.has(slug))),
      ];
      const updatedDescription =
        parsed.updatedDescription?.trim() ||
        context.description?.trim() ||
        context.title;
      const updatedSummary =
        parsed.updatedSummary?.trim() ||
        updatedDescription.slice(0, 400);
      const updatedScopeSummary =
        parsed.updatedScopeSummary?.trim() ||
        updatedSummary ||
        updatedDescription.slice(0, 300);

      return {
        applied: true,
        updatedDescription,
        updatedSummary,
        updatedScopeSummary,
        tagSlugs,
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
        provider: 'openai',
        briefPatches: parsed.briefPatches,
      };
    } catch (error) {
      this.logger.warn(
        `OpenAI scope sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
