import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from '../users/locale.types';

export interface AddendumGenerationInput {
  projectTitle: string;
  contractExcerptHtml?: string | null;
  description: string;
  locale?: string;
  pricingPercents?: {
    preliminaryPercent: number;
    overheadProfitPercent: number;
    vatPercent: number;
  } | null;
}

const LOCALE_LABEL: Record<SupportedLocale, string> = {
  en: 'English',
  ru: 'Russian',
  th: 'Thai',
};

@Injectable()
export class OpenAiContractAddendumService {
  private readonly logger = new Logger(OpenAiContractAddendumService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private resolveLocale(value?: string | null): SupportedLocale {
    const trimmed = value?.trim().toLowerCase() ?? '';
    return isSupportedLocale(trimmed) ? trimmed : DEFAULT_LOCALE;
  }

  /**
   * Returns HTML for an additional agreement body in the requested locale (no outer html/body).
   */
  async generateBodyHtml(
    input: AddendumGenerationInput,
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const locale = this.resolveLocale(input.locale);
    const language = LOCALE_LABEL[locale];

    const system = `You draft Additional Agreements (addenda) for construction contracts on BuilTHAI.
Return JSON only with keys: title (short title in ${language}), bodyHtml (HTML fragment in ${language}).
Rules:
- bodyHtml must be a complete addendum document body in ${language} using only: p, h2, h3, ul, ol, li, strong, em, table, thead, tbody, tr, th, td, br.
- Structure: heading, parties reference, purpose, changes/terms from the user description, effective date note. Do NOT include a Signatures / Employer / Contractor signature section — the platform appends live signature blocks when rendering the PDF.
- Reflect the user's description faithfully; do not invent BOQ line items unless stated.
- When the user states a new contract total/price, include a clear VAT breakdown table if pricingPercents is provided (works, preliminary, overhead & profit, subtotal excl. VAT, VAT, grand total incl. VAT).
- If pricingPercents is provided, treat an unspecified amount as VAT-inclusive unless the user explicitly says excluding VAT / без НДС / ex VAT.
- Typical user phrasings include: "new contract amount", "revised total", "увеличить стоимость договора до …", "новая сумма договора … с НДС", "3.5 million THB", "3,5 млн бат", "grand total incl. VAT".
- Keep professional legal-commercial tone suitable for Thailand construction marketplace.
- Do not wrap in <html> or <body>.
- Also accept legacy key englishBodyHtml as an alias for bodyHtml if you emit it.`;

    const user = JSON.stringify({
      projectTitle: input.projectTitle,
      outputLocale: locale,
      outputLanguage: language,
      existingContractExcerpt: (input.contractExcerptHtml ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4000),
      addendumDescription: input.description,
      pricingPercents: input.pricingPercents ?? null,
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
          temperature: 0.35,
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
      if (!content) return null;

      const parsed = JSON.parse(content) as {
        bodyHtml?: string;
        englishBodyHtml?: string;
        title?: string;
      };
      const html = (parsed.bodyHtml ?? parsed.englishBodyHtml)?.trim();
      return html || null;
    } catch (err: unknown) {
      this.logger.warn(
        `Addendum AI failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /** @deprecated Use generateBodyHtml */
  async generateEnglishBodyHtml(
    input: AddendumGenerationInput,
  ): Promise<string | null> {
    return this.generateBodyHtml(input);
  }

  async generateTitle(
    description: string,
    locale?: string,
  ): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const resolved = this.resolveLocale(locale);
    const language = LOCALE_LABEL[resolved];
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
            {
              role: 'system',
              content: `Return JSON { "title": "..." } — a short ${language} title (max 80 chars) for a contract addendum based on the description.`,
            },
            { role: 'user', content: description.slice(0, 2000) },
          ],
        }),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return null;
      const parsed = JSON.parse(content) as { title?: string };
      return parsed.title?.trim().slice(0, 120) || null;
    } catch {
      return null;
    }
  }
}
