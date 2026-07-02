import type { IntakeDocumentContext } from '../ai/intake.types';
import type { ProjectBriefV1 } from '../projects/project-brief';

export function buildDocumentIntakeContext(
  brief?: ProjectBriefV1 | null,
): IntakeDocumentContext[] {
  const insights = brief?.ai?.documentInsights ?? [];
  if (insights.length === 0) {
    return [];
  }

  const packages = brief?.packages ?? [];

  return insights.map((insight) => ({
    fileName: insight.fileName,
    summary: insight.summary,
    ...(insight.keyFacts?.length ? { keyFacts: insight.keyFacts } : {}),
    scopeLines: packages
      .filter((pkg) => pkg.sourceDocumentId === insight.documentId)
      .map((pkg) => ({
        trade: pkg.trade,
        description: pkg.description,
      })),
  }));
}

export function hasDocumentIntakeContext(
  documents?: IntakeDocumentContext[],
): boolean {
  return (documents?.length ?? 0) > 0;
}
