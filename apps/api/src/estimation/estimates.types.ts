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
  /** Client exclusions/additions applied to the latest AI estimate. */
  adjustments?: EstimateAdjustmentsView;
  availableTrades?: Array<{
    trade: string;
    label: string;
    lineMin: number;
    lineMax: number;
  }>;
  editable?: boolean;
}

export interface EstimateAdjustmentsView {
  excludedLines: Array<{ trade: string; description: string }>;
  addedLines: Array<{ trade: string; description: string }>;
}

export interface UpdateEstimateAdjustmentsDto {
  excludedLines: Array<{ trade: string; description: string }>;
  addedLines: Array<{
    trade: string;
    description?: string;
    lineMin: number;
    lineMax: number;
  }>;
}
