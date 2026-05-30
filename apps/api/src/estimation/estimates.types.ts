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

export interface BallparkEstimateResult {
  lines: EstimateLine[];
  totals: EstimateTotals;
  confidence: number;
  disclaimer: string;
  provider: 'openai' | 'fallback';
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
  createdAt: string;
}
