import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentAnalysisResult } from './document-analysis.types';

@Injectable()
export class OpenAiDocumentService {
  private readonly logger = new Logger(OpenAiDocumentService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    this.model =
      this.config.get<string>('OPENAI_VISION_MODEL', 'gpt-4o-mini').trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async analyzeImage(input: {
    imageUrl: string;
    fileName: string;
    category: string;
    projectTitle: string;
    projectDescription: string | null;
    availableTagSlugs: string[];
  }): Promise<DocumentAnalysisResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const system = `You analyze construction project photos and plans for a marketplace.
Return JSON only: { summary, confidence, property, packages, suggestedTagSlugs }.
- summary: 1-3 sentences of what you see (English)
- confidence: 0-1 (lower if image is unclear)
- property: optional { areaSqm, rooms, floors } only if visible or strongly implied
- packages: array of { trade, description, quantity?, unit?, areaSqm? } scope lines inferred from the image
- suggestedTagSlugs: subset of allowed tags only
Do not invent precise measurements unless readable. Use trade slugs like electrical, plumbing, finishing, structural, roofing, tiling, painting, flooring, carpentry, design, demolition.`;

    const userText = JSON.stringify({
      fileName: input.fileName,
      category: input.category,
      projectTitle: input.projectTitle,
      projectDescription: input.projectDescription,
      allowedTagSlugs: input.availableTagSlugs,
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
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: [
                { type: 'text', text: userText },
                { type: 'image_url', image_url: { url: input.imageUrl } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Vision HTTP ${response.status}: ${text.slice(0, 200)}`);
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return null;

      return this.normalizeResult(JSON.parse(content) as Record<string, unknown>);
    } catch (err) {
      this.logger.warn(
        `Vision failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private normalizeResult(raw: Record<string, unknown>): DocumentAnalysisResult {
    const packages = Array.isArray(raw.packages)
      ? raw.packages
          .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
          .map((p) => ({
            trade: String(p.trade ?? 'other').slice(0, 64),
            description: String(p.description ?? '').slice(0, 500),
            quantity:
              typeof p.quantity === 'number' ? p.quantity : undefined,
            unit: p.unit ? String(p.unit).slice(0, 32) : undefined,
            areaSqm: typeof p.areaSqm === 'number' ? p.areaSqm : undefined,
          }))
          .filter((p) => p.description.length > 0)
      : [];

    const property =
      raw.property && typeof raw.property === 'object'
        ? {
            areaSqm:
              typeof (raw.property as Record<string, unknown>).areaSqm ===
              'number'
                ? ((raw.property as Record<string, unknown>).areaSqm as number)
                : undefined,
            rooms:
              typeof (raw.property as Record<string, unknown>).rooms === 'number'
                ? ((raw.property as Record<string, unknown>).rooms as number)
                : undefined,
            floors:
              typeof (raw.property as Record<string, unknown>).floors ===
              'number'
                ? ((raw.property as Record<string, unknown>).floors as number)
                : undefined,
          }
        : undefined;

    return {
      summary: String(raw.summary ?? 'Document analyzed').slice(0, 1000),
      confidence:
        typeof raw.confidence === 'number'
          ? Math.min(1, Math.max(0, raw.confidence))
          : 0.5,
      property,
      packages,
      suggestedTagSlugs: Array.isArray(raw.suggestedTagSlugs)
        ? raw.suggestedTagSlugs.map((s) => String(s).slice(0, 64))
        : [],
    };
  }
}
