import { BidTermsV1 } from '../tendering/tendering.types';

export interface BidAnalysisBidInput {
  id: string;
  companyName: string | null;
  amount: string;
  durationDays: number | null;
  terms: BidTermsV1 | null;
  status: string;
  submittedAt: string;
}

export interface BidAnalysisContext {
  projectTitle: string;
  projectDescription: string | null;
  briefSummary?: string;
  ballparkMid?: number | null;
  bids: BidAnalysisBidInput[];
}

export interface BidAnalysisComparison {
  bidId: string;
  companyName: string | null;
  strengths: string[];
  weaknesses: string[];
  riskFlags: string[];
}

export interface BidAnalysisResult {
  recommendedBidId: string | null;
  recommendedCompanyName: string | null;
  summary: string;
  reasoning: string;
  comparisons: BidAnalysisComparison[];
  confidence: number;
  provider: 'openai' | 'fallback';
}

export interface StoredBidAnalysis {
  fingerprint: string;
  generatedAt: string;
  result: BidAnalysisResult;
}

export interface BidAnalysisResponse {
  analysis: BidAnalysisResult | null;
  fingerprint: string;
  generatedAt: string | null;
  canAnalyze: boolean;
  analysisUpToDate: boolean;
  submittedBidCount: number;
}
