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
import { PdfTextService } from '../pdf/pdf-text.service';

const VISION_PAGES_PER_BATCH = 3;
const VISION_MAX_PAGES = 30;

@Injectable()
export class DocumentAnalysisService {
  private readonly logger = new Logger(DocumentAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly openAiDocument: OpenAiDocumentService,
    private readonly pdfText: PdfTextService,
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
    } else if (
      (doc.contentType === 'application/pdf' ||
        doc.contentType === 'text/plain') &&
      this.storage.isConfigured() &&
      this.openAiDocument.isConfigured()
    ) {
      result = await this.analyzeTextDocument({
        doc,
        projectTitle: project.title,
        projectDescription: project.description,
        availableTagSlugs,
      });
      if (result) provider = 'openai';
    }

    if (!result) {
      result = this.fallbackAnalysis(
        doc.originalName,
        doc.category,
        doc.contentType,
      );
    }

    const freshProject = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { tags: true },
    });
    if (!freshProject) return;

    const brief = (freshProject.briefJson ?? {}) as unknown as ProjectBriefV1;
    const taggedPackages = result.packages.map((pkg) => ({
      ...pkg,
      sourceDocumentId: doc.id,
    }));
    const mergedPackages = mergePackages(brief.packages ?? [], taggedPackages);

    const insight: DocumentInsightRecord = {
      documentId: doc.id,
      fileName: doc.originalName,
      analyzedAt: new Date().toISOString(),
      summary: result.summary,
      confidence: result.confidence,
      provider,
      ...(result.omittedNote ? { omittedNote: result.omittedNote } : {}),
      ...(result.keyFacts?.length ? { keyFacts: result.keyFacts } : {}),
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
        type: brief.property?.type ?? freshProject.propertyType ?? undefined,
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
          title: freshProject.title,
          description: freshProject.description,
          projectType: freshProject.projectType,
          propertyType: freshProject.propertyType,
          district: freshProject.district,
          tagCount,
          brief: updatedBrief,
        }),
      },
    });
  }

  private async analyzeTextDocument(input: {
    doc: { storageKey: string; originalName: string; category: string; contentType: string };
    projectTitle: string;
    projectDescription: string | null;
    availableTagSlugs: string[];
  }): Promise<DocumentAnalysisResult | null> {
    try {
      const buffer = await this.storage.getObjectBuffer(input.doc.storageKey);
      const isBlueprint = input.doc.category === 'blueprint';
      let extractedText = '';
      let pageCount = 0;
      let truncated = false;

      if (input.doc.contentType === 'application/pdf') {
        const pdf = await this.pdfText.extractText(buffer);
        if (pdf) {
          extractedText = pdf.text;
          pageCount = pdf.pageCount;
          truncated = pdf.truncated;
        } else {
          pageCount = await this.pdfText.getPageCount(buffer);
        }

        const sparseText = extractedText.length < 500;
        const useVision = isBlueprint || sparseText;

        let textResult: DocumentAnalysisResult | null = null;
        if (extractedText) {
          textResult = await this.openAiDocument.analyzePdfText({
            extractedText,
            pageCount,
            truncated,
            fileName: input.doc.originalName,
            category: input.doc.category,
            projectTitle: input.projectTitle,
            projectDescription: input.projectDescription,
            availableTagSlugs: input.availableTagSlugs,
          });
        }

        let visionResult: DocumentAnalysisResult | null = null;
        if (useVision) {
          visionResult = await this.analyzePdfVisionBatched({
            buffer,
            pageCount: pageCount || (await this.pdfText.getPageCount(buffer)),
            fileName: input.doc.originalName,
            category: input.doc.category,
            projectTitle: input.projectTitle,
            projectDescription: input.projectDescription,
            availableTagSlugs: input.availableTagSlugs,
            supplementalText: extractedText || undefined,
            isBlueprint,
          });
        }

        return mergeDocumentAnalysis(textResult, visionResult, {
          preferVision: useVision,
        });
      }

      extractedText = buffer.toString('utf8').replace(/\s+/g, ' ').trim().slice(0, 24_000);
      if (!extractedText) {
        return null;
      }

      return this.openAiDocument.analyzePdfText({
        extractedText,
        pageCount,
        truncated,
        fileName: input.doc.originalName,
        category: input.doc.category,
        projectTitle: input.projectTitle,
        projectDescription: input.projectDescription,
        availableTagSlugs: input.availableTagSlugs,
      });
    } catch (err) {
      this.logger.warn(
        `Text document analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async analyzePdfVisionBatched(input: {
    buffer: Buffer;
    pageCount: number;
    fileName: string;
    category: string;
    projectTitle: string;
    projectDescription: string | null;
    availableTagSlugs: string[];
    supplementalText?: string;
    isBlueprint: boolean;
  }): Promise<DocumentAnalysisResult | null> {
    const totalPages = Math.max(input.pageCount, 1);
    const maxPages = input.isBlueprint ? VISION_MAX_PAGES : VISION_PAGES_PER_BATCH;
    const pagesToAnalyze = Math.min(totalPages, maxPages);
    const pageBatches = chunkPageNumbers(pagesToAnalyze, VISION_PAGES_PER_BATCH);

    if (pageBatches.length === 0) {
      return null;
    }

    const batchResults: Array<{
      pageNumbers: number[];
      result: DocumentAnalysisResult;
    }> = [];

    for (const pageNumbers of pageBatches) {
      const screenshots = await this.pdfText.extractScreenshots(input.buffer, {
        pageNumbers,
      });
      if (screenshots.length === 0) {
        continue;
      }

      const batchLabel = formatPageBatchLabel(
        screenshots.map((shot) => shot.pageNumber),
        totalPages,
      );
      const result = await this.openAiDocument.analyzeBlueprintPages({
        pageImages: screenshots.map((shot) => shot.dataUrl),
        pageNumbers: screenshots.map((shot) => shot.pageNumber),
        pageCount: totalPages,
        fileName: input.fileName,
        category: input.category,
        projectTitle: input.projectTitle,
        projectDescription: input.projectDescription,
        availableTagSlugs: input.availableTagSlugs,
        supplementalText: input.supplementalText,
        batchLabel,
      });

      if (result) {
        batchResults.push({
          pageNumbers: screenshots.map((shot) => shot.pageNumber),
          result,
        });
      }
    }

    if (batchResults.length === 0) {
      return null;
    }

    if (batchResults.length === 1) {
      const single = batchResults[0].result;
      if (pagesToAnalyze < totalPages) {
        return {
          ...single,
          omittedNote: appendOmittedNote(
            single.omittedNote,
            `Pages ${pagesToAnalyze + 1}-${totalPages} were not analyzed (limit ${VISION_MAX_PAGES} pages).`,
          ),
        };
      }
      return single;
    }

    const merged = await this.openAiDocument.mergeBlueprintBatches({
      fileName: input.fileName,
      pageCount: totalPages,
      analyzedPageCount: pagesToAnalyze,
      availableTagSlugs: input.availableTagSlugs,
      supplementalText: input.supplementalText,
      batches: batchResults.map((batch) => ({
        pageNumbers: batch.pageNumbers,
        summary: batch.result.summary,
        keyFacts: batch.result.keyFacts,
        packages: batch.result.packages,
        property: batch.result.property,
        confidence: batch.result.confidence,
        omittedNote: batch.result.omittedNote,
      })),
    });

    if (merged) {
      if (pagesToAnalyze < totalPages) {
        return {
          ...merged,
          omittedNote: appendOmittedNote(
            merged.omittedNote,
            `Pages ${pagesToAnalyze + 1}-${totalPages} were not analyzed (limit ${VISION_MAX_PAGES} pages).`,
          ),
        };
      }
      return merged;
    }

    return mergeMultipleDocumentAnalysis(
      batchResults.map((batch) => batch.result),
      {
        omittedNote:
          pagesToAnalyze < totalPages
            ? `Pages ${pagesToAnalyze + 1}-${totalPages} were not analyzed (limit ${VISION_MAX_PAGES} pages).`
            : undefined,
      },
    );
  }

  private fallbackAnalysis(
    fileName: string,
    category: string,
    contentType?: string,
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
      summary:
        contentType === 'application/pdf'
          ? `PDF "${fileName}" uploaded (${category}). Text extraction or AI analysis was unavailable — review the file manually.`
          : `Document "${fileName}" uploaded (${category}). AI analysis pending or unavailable — scope lines added from document type.`,
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

function mergeDocumentAnalysis(
  textResult: DocumentAnalysisResult | null,
  visionResult: DocumentAnalysisResult | null,
  options: { preferVision: boolean },
): DocumentAnalysisResult | null {
  if (!textResult && !visionResult) {
    return null;
  }
  if (!textResult) {
    return visionResult;
  }
  if (!visionResult) {
    return textResult;
  }

  const primary = options.preferVision ? visionResult : textResult;
  const secondary = options.preferVision ? textResult : visionResult;

  const keyFacts = dedupeStrings([
    ...(primary.keyFacts ?? []),
    ...(secondary.keyFacts ?? []),
  ]).slice(0, 20);

  const summary =
    visionResult.keyFacts && visionResult.keyFacts.length >= (textResult.keyFacts?.length ?? 0)
      ? visionResult.summary
      : textResult.summary.length >= visionResult.summary.length
        ? textResult.summary
        : visionResult.summary;

  return {
    summary,
    confidence: Math.max(textResult.confidence, visionResult.confidence),
    property: {
      ...textResult.property,
      ...visionResult.property,
    },
    packages: mergePackages(textResult.packages, visionResult.packages),
    suggestedTagSlugs: dedupeStrings([
      ...textResult.suggestedTagSlugs,
      ...visionResult.suggestedTagSlugs,
    ]),
    omittedNote: primary.omittedNote ?? secondary.omittedNote,
    keyFacts: keyFacts.length > 0 ? keyFacts : undefined,
  };
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
}

function chunkPageNumbers(totalPages: number, batchSize: number): number[][] {
  const batches: number[][] = [];
  for (let page = 1; page <= totalPages; page += batchSize) {
    const batch: number[] = [];
    for (let offset = 0; offset < batchSize && page + offset <= totalPages; offset++) {
      batch.push(page + offset);
    }
    if (batch.length > 0) {
      batches.push(batch);
    }
  }
  return batches;
}

function formatPageBatchLabel(pageNumbers: number[], totalPages: number): string {
  const sorted = [...pageNumbers].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const range =
    first === last ? `page ${first}` : `pages ${first}-${last}`;
  return `${range} of ${totalPages}`;
}

function appendOmittedNote(existing: string | undefined, note: string): string {
  if (!existing) {
    return note;
  }
  if (existing.includes(note)) {
    return existing;
  }
  return `${existing} ${note}`;
}

function mergeMultipleDocumentAnalysis(
  results: DocumentAnalysisResult[],
  options?: { omittedNote?: string },
): DocumentAnalysisResult | null {
  if (results.length === 0) {
    return null;
  }
  if (results.length === 1) {
    return results[0];
  }

  const keyFacts = dedupeStrings(
    results.flatMap((result) => result.keyFacts ?? []),
  ).slice(0, 20);

  const summaries = results
    .map((result) => result.summary.trim())
    .filter(Boolean);
  const summary =
    summaries.length > 1
      ? summaries.join(' ')
      : summaries[0] ?? 'Document analyzed';

  return {
    summary: summary.slice(0, 2500),
    confidence: Math.max(...results.map((result) => result.confidence)),
    property: results.reduce<DocumentAnalysisResult['property']>(
      (acc, result) => ({ ...acc, ...result.property }),
      {},
    ),
    packages: results.reduce(
      (acc, result) => mergePackages(acc, result.packages),
      [] as BriefPackage[],
    ),
    suggestedTagSlugs: dedupeStrings(
      results.flatMap((result) => result.suggestedTagSlugs),
    ),
    omittedNote: options?.omittedNote,
    keyFacts: keyFacts.length > 0 ? keyFacts : undefined,
  };
}
