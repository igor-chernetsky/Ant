import { fetchWithAuth } from './auth-client';

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

export interface BallparkEstimate {
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

export function formatThb(amount: number): string {
  return new Intl.NumberFormat('en-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export async function fetchProjectEstimate(
  projectId: string,
): Promise<BallparkEstimate | null> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/estimate`,
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load estimate');
  }

  const data = (await response.json()) as BallparkEstimate | { estimate: null };
  if ('estimate' in data && data.estimate === null) {
    return null;
  }
  return data as BallparkEstimate;
}
