import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { localeLanguageName } from '../localization/locale.utils';
import { DEFAULT_LOCALE, isSupportedLocale } from '../users/locale.types';
import { TAG_NO_HALLUCINATION_RULES } from '../projects/project-tag-reconciliation';
import { AmendmentAiResult, AmendmentContext } from './amendment.types';

@Injectable()
export class OpenAiAmendmentService {
  private readonly logger = new Logger(OpenAiAmendmentService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async processAmendments(
    context: AmendmentContext,
  ): Promise<AmendmentAiResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const language =
      context.locale && isSupportedLocale(context.locale)
        ? localeLanguageName(context.locale)
        : localeLanguageName(DEFAULT_LOCALE);

    const system = `You are a construction marketplace assistant. The client added ONE chronological amendment to their project before tendering starts.
Apply this single amendment on top of the CURRENT project understanding (description + brief, which already includes earlier intake answers and previously applied amendments). Return JSON only with keys:
updatedDescription, updatedSummary, tagSlugs, confidence, briefPatches.
briefPatches may include: constraints (string), property (object), timeline (object), materials (object).
Priority / conflict rules (CRITICAL):
- The amendment in the payload is the latest instruction. It OVERRIDES conflicting statements in the current description/summary.
- Apply instructions in sequence: if an earlier state said "include X" and this amendment says "remove X", remove X. If this amendment says "add X" (even after a prior remove), include X as required scope.
- Do NOT try to reconcile contradictory older and newer wording into a hybrid. Prefer the latest amendment's intent.
- Meta notes like "will be added to the estimate later" are not a substitute for stating the system as required scope when the amendment asks to add it.
Content rules:
- Keep factual content from the current brief that the amendment does not cancel.
- CRITICAL: updatedDescription must preserve the FULL prior project narrative except where this amendment removes or replaces facts. Never replace the whole description with only the amendment text.
- CRITICAL: updatedSummary must stay a project-level brief, not a single micro-task sentence.
- updatedDescription: full narrative for contractors (2-6 sentences, or longer if prior text was longer). Explicitly name cost-driving MEP upgrades and newly requested systems (fire suppression, specialty lighting, utility connections, etc.) as required scope when the amendment asks for them.
- updatedSummary: shorter headline summary (1-3 sentences) that still covers the main works.
- tagSlugs: subset of allowed tags only. When this amendment requests automatic fire extinguishing / sprinklers, include "fire-suppression". When it removes a system, drop related tags if no longer in scope.
- confidence: 0-1.
- Write updatedDescription and updatedSummary in ${language}.
- Keep ${language} throughout — do not translate existing content into another language.
${TAG_NO_HALLUCINATION_RULES}`;

    const user = JSON.stringify({
      project: {
        title: context.title,
        description: context.description,
        projectType: context.projectType,
        propertyType: context.propertyType,
        district: context.district,
      },
      brief: context.brief,
      amendment: context.amendments[0] ?? null,
      allowedTagSlugs: context.availableTagSlugs,
      processingMode: 'sequential_single_amendment',
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
        updatedDescription?: string;
        updatedSummary?: string;
        tagSlugs?: string[];
        confidence?: number;
        briefPatches?: AmendmentAiResult['briefPatches'];
      };

      const allowed = new Set(context.availableTagSlugs);
      const tagSlugs = [...new Set((parsed.tagSlugs ?? []).filter((s) => allowed.has(s)))];

      return {
        updatedDescription:
          parsed.updatedDescription?.trim() ||
          context.description?.trim() ||
          context.title,
        updatedSummary:
          parsed.updatedSummary?.trim() ||
          parsed.updatedDescription?.trim() ||
          context.brief.summary ||
          '',
        tagSlugs,
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
        provider: 'openai',
        briefPatches: parsed.briefPatches,
      };
    } catch (err) {
      this.logger.warn(
        `OpenAI amendment call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
