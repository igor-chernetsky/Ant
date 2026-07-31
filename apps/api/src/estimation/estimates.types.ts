export interface EstimateLine {
  trade: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceMin: number;
  unitPriceMax: number;
  lineMin: number;
  lineMax: number;
}

export interface EstimateTotals {
  minAmount: number;
  maxAmount: number;
  midAmount: number;
  currency: string;
}

export interface EstimateRefinementAnswer {
  question: string;
  answer: string;
  answeredAt: string;
}

export interface EstimateMeta {
  improvementQuestions: string[];
}

export interface BallparkEstimateResult {
  lines: EstimateLine[];
  totals: EstimateTotals;
  confidence: number;
  disclaimer: string;
  provider: 'openai' | 'fallback';
  improvementQuestions: string[];
}

export interface EstimateResponse {
  id: string;
  projectId: string;
  type: string;
  currency: string;
  totals: EstimateTotals;
  lines: EstimateLine[];
  confidence: number;
  disclaimer: string;
  improvementQuestions: string[];
  refinementAnswers: EstimateRefinementAnswer[];
  createdAt: string;
}
