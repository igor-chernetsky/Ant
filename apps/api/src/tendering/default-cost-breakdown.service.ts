import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectBriefV1 } from '../projects/project-brief';
import { EstimateLine } from '../estimation/estimates.types';
import {
  applyEstimateAdjustments,
  parseEstimateAdjustments,
} from '../estimation/estimate-adjustments.util';
import {
  DefaultCostBreakdownItem,
  MAX_DEFAULT_COST_BREAKDOWN_ITEMS,
} from './tendering.types';

/** Do two breakdown templates describe the same rows, in the same order? */
export function itemsMatch(
  a: DefaultCostBreakdownItem[],
  b: DefaultCostBreakdownItem[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((item, index) => {
    const other = b[index];
    if (!other) return false;
    return (
      item.trade.trim().toLowerCase() === other.trade.trim().toLowerCase() &&
      (item.description?.trim() ?? '').toLowerCase() ===
        (other.description?.trim() ?? '').toLowerCase()
    );
  });
}

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
    const items = await this.generateForProject(projectId);

    await this.prisma.tender.update({
      where: { id: tenderId },
      data: {
        defaultCostBreakdown: items as unknown as Prisma.InputJsonValue,
      },
    });

    return items;
  }

  /**
   * Resolve the cost-breakdown template for a tender.
   *
   * A stored template is authoritative: the client edits those rows by hand in
   * the publish modal, so re-deriving the list from the ballpark estimate — even
   * when the stored one is shorter — silently discarded their additions and
   * removals before the contractor ever saw them. Deriving happens only while
   * nothing is stored yet.
   *
   * `autoSync` is passed while the client has never submitted a list of their own
   * and no contractor has applied yet: there the template follows the estimate, so
   * an updated budget is not silently ignored.
   */
  async resolveForTender(
    tenderId: string,
    projectId: string,
    storedRaw: unknown,
    options?: { autoSync?: boolean },
  ): Promise<DefaultCostBreakdownItem[]> {
    const stored = this.parseStored(storedRaw);

    if (options?.autoSync) {
      const estimateItems = await this.estimateTemplateForProject(projectId);
      if (estimateItems.length > 0 && !itemsMatch(estimateItems, stored)) {
        await this.prisma.tender.update({
          where: { id: tenderId },
          data: {
            defaultCostBreakdown:
              estimateItems as unknown as Prisma.InputJsonValue,
          },
        });
        return estimateItems;
      }
      if (stored.length > 0) {
        return stored;
      }
    }

    if (stored.length > 0) {
      return stored;
    }

    const estimateItems = await this.estimateTemplateForProject(projectId);
    if (estimateItems.length > 0) {
      await this.prisma.tender.update({
        where: { id: tenderId },
        data: {
          defaultCostBreakdown:
            estimateItems as unknown as Prisma.InputJsonValue,
        },
      });
      return estimateItems;
    }

    return this.generateAndStoreForTender(tenderId, projectId);
  }

  /**
   * Deterministic template derived from the latest ballpark estimate (no AI).
   * Used for auto-sync and to tell whether the client edited the list by hand.
   */
  async estimateTemplateForProject(
    projectId: string,
  ): Promise<DefaultCostBreakdownItem[]> {
    return this.itemsFromLatestEstimate(projectId);
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
      ? ((estimate.linesJson as EstimateLine[] | null) ?? [])
      : [];
    const brief = (project.briefJson as ProjectBriefV1 | null) ?? null;

    // The client sees the ballpark estimate WITH their adjustments applied
    // (added / excluded lines, design fee), so the template must be derived from
    // that same list — deriving it from the raw estimate lines produced a
    // published breakdown that did not match the budget on the project page.
    if (estimateLines.length > 0) {
      return this.itemsFromLatestEstimate(projectId);
    }

    // No ballpark lines at all: fall back to AI / brief packages. Never let AI
    // collapse a detailed estimate into a short generic template.
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

  private async itemsFromLatestEstimate(
    projectId: string,
  ): Promise<DefaultCostBreakdownItem[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        title: true,
        description: true,
        briefJson: true,
        projectType: true,
        designFeePercent: true,
        estimateAdjustmentsJson: true,
      },
    });
    const estimate = await this.prisma.estimate.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { linesJson: true },
    });
    if (!estimate || !project) {
      return [];
    }
    const baseLines = (estimate.linesJson as EstimateLine[] | null) ?? [];
    if (baseLines.length === 0) {
      return [];
    }
    const adjustments = parseEstimateAdjustments(project.estimateAdjustmentsJson);
    const brief = (project.briefJson as ProjectBriefV1 | null) ?? {
      schemaVersion: 1,
    };
    const narrative = [project.title, project.description ?? ''].join('\n');
    const effective = applyEstimateAdjustments({
      lines: baseLines,
      adjustments,
      brief,
      narrative,
      designFeePercent: project.designFeePercent,
      isDesignProject: project.projectType === 'design',
    });
    return this.normalizeItems(this.itemsFromEstimateLines(effective.lines));
  }

  private itemsFromEstimateLines(
    estimateLines: EstimateLine[],
  ): DefaultCostBreakdownItem[] {
    return estimateLines.map((line) => ({
      trade: line.trade,
      description: line.description || undefined,
    }));
  }

  private normalizeItems(
    items: DefaultCostBreakdownItem[],
  ): DefaultCostBreakdownItem[] {
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
        signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.25,
          response_format: { type: 'json_object' },
          max_tokens: 1500,
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
      return this.itemsFromEstimateLines(estimateLines);
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
