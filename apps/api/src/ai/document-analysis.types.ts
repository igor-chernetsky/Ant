export interface BriefPackage {
  trade: string;
  description: string;
  quantity?: number;
  unit?: string;
  areaSqm?: number;
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
}

export interface DocumentInsightRecord {
  documentId: string;
  fileName: string;
  analyzedAt: string;
  summary: string;
  confidence: number;
  provider: 'openai' | 'fallback';
}
