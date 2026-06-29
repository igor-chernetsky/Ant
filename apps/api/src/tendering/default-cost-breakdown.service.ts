import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectBriefV1 } from '../projects/project-brief';
import { EstimateLine } from '../estimation/estimates.types';
import {
  DefaultCostBreakdownItem,
  MAX_DEFAULT_COST_BREAKDOWN_ITEMS,
} from './tendering.types';

@Injectable()
export class DefaultCostBreakdownService {
  private readonly logger = new Logger(DefaultCostBreakdownService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    this.model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini').trim();
  }

  parseStored(raw: unknown): DefaultCostBreakdownItem[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const items: DefaultCostBreakdownItem[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const trade = String((entry as { trade?: unknown }).trade ?? '').trim();
      if (!trade) {
        continue;
      }
      const description = String(
        (entry as { description?: unknown }).description ?? '',
      ).trim();
      items.push({
        trade,
        ...(description ? { description } : {}),
      });
    }

    return items.slice(0, MAX_DEFAULT_COST_BREAKDOWN_ITEMS);
  }

  async generateAndStoreForTender(
    tenderId: string,
    projectId: string,
  ): Promise<DefaultCostBreakdownItem[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tags: { include: { tag: true } },
        estimates: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!project) {
      return [];
    }

    const estimate = project.estimates[0];
    const estimateLines = estimate
      ? (estimate.linesJson as EstimateLine[] | null) ?? []
      : [];
    const brief = (project.briefJson as ProjectBriefV1 | null) ?? null;

    const items =
      (await this.generateWithOpenAi({
        title: project.title,
        description: project.description,
        projectType: project.projectType,
        propertyType: project.propertyType,
        district: project.district,
        tagSlugs: project.tags.map((pt) => pt.tag.slug),
        brief,
        estimateLines,
      })) ?? this.generateFallback(brief, estimateLines, project.projectType);

    const normalized = this.normalizeItems(items);

    await this.prisma.tender.update({
      where: { id: tenderId },
      data: {
        defaultCostBreakdown: normalized as unknown as Prisma.InputJsonValue,
      },
    });

    return normalized;
  }

  async generateForProject(projectId: string): Promise<DefaultCostBreakdownItem[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tags: { include: { tag: true } },
        estimates: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!project) {
      return [];
    }

    const estimate = project.estimates[0];
    const estimateLines = estimate
      ? (estimate.linesJson as EstimateLine[] | null) ?? []
      : [];
    const brief = (project.briefJson as ProjectBriefV1 | null) ?? null;

    const items =
      (await this.generateWithOpenAi({
        title: project.title,
        description: project.description,
        projectType: project.projectType,
        propertyType: project.propertyType,
        district: project.district,
        tagSlugs: project.tags.map((pt) => pt.tag.slug),
        brief,
        estimateLines,
      })) ?? this.generateFallback(brief, estimateLines, project.projectType);

    return this.normalizeItems(items);
  }

  private normalizeItems(items: DefaultCostBreakdownItem[]): DefaultCostBreakdownItem[] {
    const seen = new Set<string>();
    const result: DefaultCostBreakdownItem[] = [];

    for (const item of items) {
      const trade = item.trade.trim();
      if (!trade) {
        continue;
      }
      const key = trade.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const description = item.description?.trim();
      result.push({
        trade,
        ...(description ? { description } : {}),
      });
      if (result.length >= MAX_DEFAULT_COST_BREAKDOWN_ITEMS) {
        break;
      }
    }

    return result;
  }

  private async generateWithOpenAi(input: {
    title: string;
    description: string | null;
    projectType: string;
    propertyType: string | null;
    district: string | null;
    tagSlugs: string[];
    brief: ProjectBriefV1 | null;
    estimateLines: EstimateLine[];
  }): Promise<DefaultCostBreakdownItem[] | null> {
    if (!this.apiKey) {
      return null;
    }

    const system = `You define a standard cost breakdown template for construction tender proposals in Thailand.
Return JSON only: { "items": [{ "trade": string, "description": string }] }.
Rules:
- 4-${MAX_DEFAULT_COST_BREAKDOWN_ITEMS} lines covering the likely scope of work.
- trade: short trade name (e.g. Demolition, Plumbing, Electrical).
- description: one short scope note for contractors (what to price under this line).
- Do NOT include amounts or prices.
- Use English. Align with the project scope; do not invent unrelated trades.`;

    const user = JSON.stringify({
      project: {
        title: input.title,
        description: input.description,
        projectType: input.projectType,
        propertyType: input.propertyType,
        district: input.district,
        tags: input.tagSlugs,
      },
      brief: {
        summary: input.brief?.summary,
        packages: input.brief?.packages,
        property: input.brief?.property,
        constraints: input.brief?.constraints,
      },
      ballparkEstimateLines: input.estimateLines.map((line) => ({
        trade: line.trade,
        description: line.description,
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
          model: this.model,
          temperature: 0.25,
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

      const parsed = JSON.parse(content) as {
        items?: Array<{ trade?: string; description?: string }>;
      };

      return (parsed.items ?? [])
        .map((item) => ({
          trade: item.trade?.trim() ?? '',
          description: item.description?.trim() || undefined,
        }))
        .filter((item) => item.trade.length > 0);
    } catch (err) {
      this.logger.warn(
        `Cost breakdown AI failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private generateFallback(
    brief: ProjectBriefV1 | null,
    estimateLines: EstimateLine[],
    projectType: string,
  ): DefaultCostBreakdownItem[] {
    if (estimateLines.length > 0) {
      return estimateLines.map((line) => ({
        trade: line.trade,
        description: line.description || undefined,
      }));
    }

    if (brief?.packages?.length) {
      return brief.packages.map((pkg) => ({
        trade: pkg.trade,
        description: pkg.description || undefined,
      }));
    }

    const genericByType: Record<string, DefaultCostBreakdownItem[]> = {
      renovation: [
        { trade: 'Demolition & preparation', description: 'Strip-out and site prep' },
        { trade: 'Masonry & structure', description: 'Walls, openings, minor structural' },
        { trade: 'Plumbing', description: 'Water supply and drainage' },
        { trade: 'Electrical', description: 'Wiring, fixtures, panels' },
        { trade: 'Finishes', description: 'Flooring, painting, ceilings' },
      ],
      new_build: [
        { trade: 'Foundation & structure', description: 'Substructure and frame' },
        { trade: 'Roofing', description: 'Roof structure and covering' },
        { trade: 'MEP', description: 'Mechanical, electrical, plumbing' },
        { trade: 'Facades & windows', description: 'External envelope' },
        { trade: 'Interior finishes', description: 'Fit-out and finishes' },
      ],
    };

    return (
      genericByType[projectType] ?? [
        { trade: 'General works', description: 'Main construction scope' },
        { trade: 'MEP', description: 'Mechanical, electrical, plumbing' },
        { trade: 'Finishes', description: 'Final finishes and fixtures' },
      ]
    );
  }
}
