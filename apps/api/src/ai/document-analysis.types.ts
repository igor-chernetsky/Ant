export interface BriefPackage {
  trade: string;
  description: string;
  quantity?: number;
  unit?: string;
  areaSqm?: number;
  /** Set when scope line was inferred from a specific uploaded document */
  sourceDocumentId?: string;
}

export interface DocumentAnalysisResult {
  summary: string;
  confidence: number;
  property?: {
    areaSqm?: number;
    rooms?: number;
    floors?: number;
  };
  packages: BriefPackage[];
  suggestedTagSlugs: string[];
  /** What noisy sections were left out of the summary */
  omittedNote?: string;
  keyFacts?: string[];
}

export interface DocumentInsightRecord {
  documentId: string;
  fileName: string;
  analyzedAt: string;
  summary: string;
  confidence: number;
  provider: 'openai' | 'fallback';
  omittedNote?: string;
  keyFacts?: string[];
}
