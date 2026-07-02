import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentAnalysisResult } from './document-analysis.types';

const DETAIL_LIMITS = {
  default: { summaryMax: 1000, keyFactsMax: 8 },
  blueprint: { summaryMax: 2500, keyFactsMax: 20 },
} as const;

type AnalysisDetailLevel = keyof typeof DETAIL_LIMITS;

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

    const detailLevel: AnalysisDetailLevel =
      input.category === 'blueprint' ? 'blueprint' : 'default';
    const system =
      detailLevel === 'blueprint'
        ? this.blueprintVisionSystemPrompt()
        : `You analyze construction project photos and plans for a marketplace.
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

      return this.normalizeResult(
        JSON.parse(content) as Record<string, unknown>,
        detailLevel,
      );
    } catch (err) {
      this.logger.warn(
        `Vision failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async analyzeBlueprintPages(input: {
    pageImages: string[];
    pageNumbers: number[];
    pageCount: number;
    fileName: string;
    category: string;
    projectTitle: string;
    projectDescription: string | null;
    availableTagSlugs: string[];
    supplementalText?: string;
    batchLabel?: string;
  }): Promise<DocumentAnalysisResult | null> {
    if (!this.isConfigured() || input.pageImages.length === 0) {
      return null;
    }

    const system = `${this.blueprintVisionSystemPrompt()}

When analyzing a page batch from a multi-page PDF:
- Focus only on content visible on the provided page(s)
- Mention page/sheet numbers in keyFacts when identifiable (e.g. "Page 4: ground floor plan")
- Do not assume content from other pages`;

    const userText = JSON.stringify({
      fileName: input.fileName,
      category: input.category,
      projectTitle: input.projectTitle,
      projectDescription: input.projectDescription,
      allowedTagSlugs: input.availableTagSlugs,
      pageCount: input.pageCount,
      pageNumbers: input.pageNumbers,
      batchLabel: input.batchLabel,
      pagesProvided: input.pageImages.length,
      supplementalText: input.supplementalText?.slice(0, 4000) || undefined,
    });

    const imageContent = input.pageImages.map((dataUrl) => ({
      type: 'image_url' as const,
      image_url: { url: dataUrl },
    }));

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
              content: [{ type: 'text', text: userText }, ...imageContent],
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `Blueprint vision HTTP ${response.status}: ${text.slice(0, 200)}`,
        );
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return null;

      return this.normalizeResult(
        JSON.parse(content) as Record<string, unknown>,
        'blueprint',
      );
    } catch (err) {
      this.logger.warn(
        `Blueprint vision failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async mergeBlueprintBatches(input: {
    fileName: string;
    pageCount: number;
    analyzedPageCount: number;
    availableTagSlugs: string[];
    batches: Array<{
      pageNumbers: number[];
      summary: string;
      keyFacts?: string[];
      packages: DocumentAnalysisResult['packages'];
      property?: DocumentAnalysisResult['property'];
      confidence: number;
      omittedNote?: string;
    }>;
    supplementalText?: string;
  }): Promise<DocumentAnalysisResult | null> {
    if (!this.isConfigured() || input.batches.length === 0) {
      return null;
    }

    if (input.batches.length === 1) {
      const batch = input.batches[0];
      return {
        summary: batch.summary,
        confidence: batch.confidence,
        property: batch.property,
        packages: batch.packages,
        suggestedTagSlugs: [],
        omittedNote: batch.omittedNote,
        keyFacts: batch.keyFacts,
      };
    }

    const system = `You merge partial analyses of different page batches from the same construction PDF into one unified project brief.
Return JSON only: { summary, confidence, property, packages, suggestedTagSlugs, omittedNote, keyFacts }.

Rules:
- summary: 4-12 English sentences covering the FULL analyzed document — synthesize all batches, deduplicate, preserve specific dimensions and room names.
- keyFacts: up to 20 deduplicated concrete bullets from all batches; keep page references when helpful.
- property: merge { areaSqm, rooms, floors } — prefer values that appear consistent across batches.
- packages: deduplicated scope lines from all batches.
- suggestedTagSlugs: subset of allowed tags only.
- confidence: 0-1 reflecting overall legibility across batches.
- omittedNote: note any page ranges not analyzed if analyzedPageCount < pageCount.

Do not invent facts not present in the batch inputs.`;

    const userText = JSON.stringify({
      fileName: input.fileName,
      pageCount: input.pageCount,
      analyzedPageCount: input.analyzedPageCount,
      allowedTagSlugs: input.availableTagSlugs,
      supplementalText: input.supplementalText?.slice(0, 4000) || undefined,
      batches: input.batches.map((batch) => ({
        pageNumbers: batch.pageNumbers,
        summary: batch.summary,
        keyFacts: batch.keyFacts,
        packages: batch.packages,
        property: batch.property,
        confidence: batch.confidence,
        omittedNote: batch.omittedNote,
      })),
    });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim(),
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userText },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `Blueprint merge HTTP ${response.status}: ${text.slice(0, 200)}`,
        );
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return null;

      const merged = this.normalizeResult(
        JSON.parse(content) as Record<string, unknown>,
        'blueprint',
      );

      const suggestedTagSlugs = dedupeTagSlugs(
        input.batches.flatMap((batch) =>
          batch.packages.map((pkg) => pkg.trade),
        ),
      );

      return {
        ...merged,
        packages: mergePackagesFromBatches(
          input.batches.map((batch) => batch.packages),
          merged.packages,
        ),
        suggestedTagSlugs:
          merged.suggestedTagSlugs.length > 0
            ? merged.suggestedTagSlugs
            : suggestedTagSlugs,
        confidence: Math.min(
          merged.confidence,
          Math.max(...input.batches.map((batch) => batch.confidence)),
        ),
      };
    } catch (err) {
      this.logger.warn(
        `Blueprint merge failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async analyzePdfText(input: {
    extractedText: string;
    pageCount: number;
    truncated: boolean;
    fileName: string;
    category: string;
    projectTitle: string;
    projectDescription: string | null;
    availableTagSlugs: string[];
  }): Promise<DocumentAnalysisResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const detailLevel: AnalysisDetailLevel =
      input.category === 'blueprint' ? 'blueprint' : 'default';
    const limits = DETAIL_LIMITS[detailLevel];

    const system =
      detailLevel === 'blueprint'
        ? `You extract construction-relevant facts from architectural/construction PDF text (title blocks, schedules, notes, dimensions) for a marketplace project brief.
Return JSON only: { summary, confidence, property, packages, suggestedTagSlugs, omittedNote, keyFacts }.

Rules:
- summary: 4-10 detailed English sentences for project description — include document type, layout, levels, room names, dimensions, total areas, materials, and location from title block when present. Never write vague lines like "contains schemes for a house".
- keyFacts: up to ${limits.keyFactsMax} short bullets with concrete measurable facts (room sizes, storey count, GFA, plot size, structural/MEP notes).
- property: optional { areaSqm, rooms, floors } when clearly stated.
- packages: scope lines { trade, description, quantity?, unit?, areaSqm? } useful for estimating/tendering.
- suggestedTagSlugs: subset of allowed tags only.
- confidence: 0-1 (lower if text is noisy, scanned, or incomplete).
- omittedNote: optional one sentence on ignored boilerplate.

Do not invent measurements. Extract every readable dimension and room label from the text.`
        : `You extract construction-relevant facts from PDF document text for a marketplace project brief.
Return JSON only: { summary, confidence, property, packages, suggestedTagSlugs, omittedNote, keyFacts }.

Rules:
- summary: 2-4 concise English sentences for AI/project context. Paraphrase — never paste long raw excerpts.
- omittedNote: optional one sentence listing what you ignored (legal boilerplate, ads, repeated headers, unrelated appendices).
- keyFacts: optional array of up to 8 short bullets with scope-relevant facts only.
- property: optional { areaSqm, rooms, floors } when clearly stated in the document.
- packages: scope lines { trade, description, quantity?, unit?, areaSqm? } useful for estimating/tendering.
- suggestedTagSlugs: subset of allowed tags only.
- confidence: 0-1 (lower if text is noisy, scanned, or incomplete).

Ignore pricing tables unless they clarify scope quantities. Do not invent measurements.`;

    const userText = JSON.stringify({
      fileName: input.fileName,
      category: input.category,
      projectTitle: input.projectTitle,
      projectDescription: input.projectDescription,
      allowedTagSlugs: input.availableTagSlugs,
      pageCount: input.pageCount,
      textTruncated: input.truncated,
      documentText: input.extractedText,
    });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim(),
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userText },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`PDF analysis HTTP ${response.status}: ${text.slice(0, 200)}`);
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return null;

      return this.normalizeResult(
        JSON.parse(content) as Record<string, unknown>,
        detailLevel,
      );
    } catch (err) {
      this.logger.warn(
        `PDF analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private blueprintVisionSystemPrompt(): string {
    return `You analyze architectural and construction drawings (floor plans, elevations, sections, site plans, MEP/structural schemes) for a marketplace project brief.
Return JSON only: { summary, confidence, property, packages, suggestedTagSlugs, omittedNote, keyFacts }.

CRITICAL: Extract SPECIFIC technical details visible on the drawing. Forbidden: vague summaries like "document contains schemes for a house in area X".

summary: 4-10 English sentences covering:
- Drawing type(s) on the provided page(s)
- Building layout, storey levels, and circulation if visible
- Named rooms/zones with dimensions when readable
- Total built area, plot size, or key overall dimensions if shown
- Structural, MEP, or material notes visible on the sheet
- Title block project name, address, or revision if legible

keyFacts: up to 20 short bullets with concrete facts, e.g. "Living room 4.20m × 5.10m", "3 bedrooms on 2nd floor", "GFA 185 sqm", "RC slab structure noted".

property: optional { areaSqm, rooms, floors } when readable or strongly implied from labels/dimensions.
packages: scope lines { trade, description, quantity?, unit?, areaSqm? } for work implied by the drawing.
suggestedTagSlugs: subset of allowed tags only.
confidence: 0-1 (lower if resolution is poor or annotations are illegible).
omittedNote: optional note on unreadable areas.

Do not invent measurements — only report what is visible or clearly labeled. Use trade slugs like electrical, plumbing, finishing, structural, roofing, tiling, painting, flooring, carpentry, design, demolition.`;
  }

  private normalizeResult(
    raw: Record<string, unknown>,
    detailLevel: AnalysisDetailLevel = 'default',
  ): DocumentAnalysisResult {
    const limits = DETAIL_LIMITS[detailLevel];
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
      summary: String(raw.summary ?? 'Document analyzed').slice(0, limits.summaryMax),
      confidence:
        typeof raw.confidence === 'number'
          ? Math.min(1, Math.max(0, raw.confidence))
          : 0.5,
      property,
      packages,
      suggestedTagSlugs: Array.isArray(raw.suggestedTagSlugs)
        ? raw.suggestedTagSlugs.map((s) => String(s).slice(0, 64))
        : [],
      omittedNote: raw.omittedNote
        ? String(raw.omittedNote).slice(0, 500)
        : undefined,
      keyFacts: Array.isArray(raw.keyFacts)
        ? raw.keyFacts
            .map((fact) => String(fact).trim())
            .filter(Boolean)
            .slice(0, limits.keyFactsMax)
        : undefined,
    };
  }
}

function dedupeTagSlugs(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function mergePackagesFromBatches(
  batchPackages: DocumentAnalysisResult['packages'][],
  mergedPackages: DocumentAnalysisResult['packages'],
): DocumentAnalysisResult['packages'] {
  const combined = batchPackages.flat();
  const seen = new Set<string>();
  const result: DocumentAnalysisResult['packages'] = [];

  for (const pkg of [...combined, ...mergedPackages]) {
    const key = `${pkg.trade}:${pkg.description.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(pkg);
  }

  return result.slice(0, 40);
}
