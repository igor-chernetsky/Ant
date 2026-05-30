import { Injectable, Logger } from '@nestjs/common';
import { Prisma, TagSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  ProjectBriefV1,
  computeReadinessScore,
} from '../projects/project-brief';
import {
  BriefPackage,
  DocumentAnalysisResult,
  DocumentInsightRecord,
} from './document-analysis.types';
import { OpenAiDocumentService } from './openai-document.service';

@Injectable()
export class DocumentAnalysisService {
  private readonly logger = new Logger(DocumentAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly openAiDocument: OpenAiDocumentService,
  ) {}

  scheduleAnalysis(projectId: string, documentId: string): void {
    void this.analyzeAndMerge(projectId, documentId).catch((err) => {
      this.logger.warn(
        `Document analysis failed for ${documentId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async analyzeAndMerge(projectId: string, documentId: string): Promise<void> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId, status: 'uploaded' },
    });
    if (!doc) return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { tags: true },
    });
    if (!project) return;

    const tags = await this.prisma.tag.findMany({ select: { slug: true } });
    const availableTagSlugs = tags.map((t) => t.slug);

    let result: DocumentAnalysisResult | null = null;
    let provider: 'openai' | 'fallback' = 'fallback';

    if (doc.contentType.startsWith('image/') && this.openAiDocument.isConfigured()) {
      const { downloadUrl } = await this.storage.createPresignedDownload(
        doc.storageKey,
      );
      result = await this.openAiDocument.analyzeImage({
        imageUrl: downloadUrl,
        fileName: doc.originalName,
        category: doc.category,
        projectTitle: project.title,
        projectDescription: project.description,
        availableTagSlugs,
      });
      if (result) provider = 'openai';
    }

    if (!result) {
      result = this.fallbackAnalysis(doc.originalName, doc.category);
    }

    const brief = (project.briefJson ?? {}) as unknown as ProjectBriefV1;
    const mergedPackages = mergePackages(brief.packages ?? [], result.packages);

    const insight: DocumentInsightRecord = {
      documentId: doc.id,
      fileName: doc.originalName,
      analyzedAt: new Date().toISOString(),
      summary: result.summary,
      confidence: result.confidence,
      provider,
    };

    const existingInsights = brief.ai?.documentInsights ?? [];
    const documentInsights = [
      ...existingInsights.filter((i) => i.documentId !== doc.id),
      insight,
    ];

    const updatedBrief: ProjectBriefV1 = {
      ...brief,
      schemaVersion: 1,
      packages: mergedPackages,
      property: {
        ...brief.property,
        ...result.property,
        type: brief.property?.type ?? project.propertyType ?? undefined,
      },
      design: {
        ...brief.design,
        hasPlans:
          doc.category === 'blueprint' || brief.design?.hasPlans === true,
      },
      ai: {
        ...brief.ai,
        documentInsights,
        confidence: Math.max(brief.ai?.confidence ?? 0, result.confidence),
      },
    };

    const tagSlugs = result.suggestedTagSlugs.filter((s) =>
      availableTagSlugs.includes(s),
    );
    if (tagSlugs.length > 0) {
      await this.addAiTags(projectId, tagSlugs);
    }

    const tagCount = await this.prisma.projectTag.count({
      where: { projectId },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        briefJson: updatedBrief as unknown as Prisma.InputJsonValue,
        readinessScore: computeReadinessScore({
          title: project.title,
          description: project.description,
          projectType: project.projectType,
          propertyType: project.propertyType,
          district: project.district,
          tagCount,
          brief: updatedBrief,
        }),
      },
    });
  }

  private fallbackAnalysis(
    fileName: string,
    category: string,
  ): DocumentAnalysisResult {
    const lower = `${fileName} ${category}`.toLowerCase();
    const packages: BriefPackage[] = [];

    if (category === 'blueprint' || lower.includes('plan')) {
      packages.push({
        trade: 'design',
        description: 'Review architectural/floor plans for scope confirmation',
      });
    }
    if (category === 'photo' || lower.includes('photo')) {
      packages.push({
        trade: 'finishing',
        description: 'On-site conditions visible in uploaded photo',
      });
    }

    return {
      summary: `Document "${fileName}" uploaded (${category}). AI vision analysis pending or unavailable — scope lines added from document type.`,
      confidence: 0.25,
      packages,
      suggestedTagSlugs: [],
    };
  }

  private async addAiTags(projectId: string, slugs: string[]) {
    const tags = await this.prisma.tag.findMany({
      where: { slug: { in: slugs } },
    });
    for (const tag of tags) {
      await this.prisma.projectTag.upsert({
        where: {
          projectId_tagId: { projectId, tagId: tag.id },
        },
        create: {
          projectId,
          tagId: tag.id,
          source: TagSource.ai,
        },
        update: {},
      });
    }
  }
}

export function mergePackages(
  existing: BriefPackage[],
  incoming: BriefPackage[],
): BriefPackage[] {
  const merged = [...existing];
  for (const pkg of incoming) {
    const duplicate = merged.some(
      (e) =>
        e.trade === pkg.trade &&
        e.description.toLowerCase() === pkg.description.toLowerCase(),
    );
    if (!duplicate) {
      merged.push(pkg);
    }
  }
  return merged.slice(0, 40);
}
