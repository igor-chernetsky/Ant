import { fetchWithAuth } from './auth-client';

export type ProgressClaimStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected';

export interface ProgressClaimLine {
  id: string;
  sortOrder: number;
  trade: string;
  description: string | null;
  contractAmount: number;
  percentComplete: number;
  amountPreviouslyApproved: number;
  amountCumulative: number;
  amountPeriod: number;
}

export interface ProgressClaim {
  id: string;
  projectId: string;
  bidId: string;
  sequenceNumber: number;
  status: ProgressClaimStatus;
  note: string | null;
  rejectionReason: string | null;
  preliminaryPercent: number;
  overheadProfitPercent: number;
  vatPercent: number;
  worksCumulative: number;
  preliminaryCumulative: number;
  overheadProfitCumulative: number;
  vatCumulative: number;
  grandCumulative: number;
  worksPeriod: number;
  preliminaryPeriod: number;
  overheadProfitPeriod: number;
  vatPeriod: number;
  grandPeriod: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ProgressClaimLine[];
}

export interface ProgressBaselineLine {
  trade: string;
  description: string | null;
  contractAmount: number;
  approvedPercent: number;
  approvedAmount: number;
}

export interface ProgressOverview {
  projectId: string;
  bidId: string;
  editable: boolean;
  role: 'client' | 'contractor' | null;
  contractGrandTotal: number;
  approvedGrandCumulative: number;
  remainingGrand: number;
  preliminaryPercent: number;
  overheadProfitPercent: number;
  vatPercent: number;
  baselineLines: ProgressBaselineLine[];
  openClaim: ProgressClaim | null;
  claims: ProgressClaim[];
}

async function parseError(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (typeof data.message === 'string') message = data.message;
    else if (Array.isArray(data.message)) message = data.message.join(', ');
  } catch {
    // keep fallback
  }
  throw new Error(message);
}

export async function fetchProjectProgress(
  projectId: string,
): Promise<ProgressOverview> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/progress`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load progress');
  }
  return response.json() as Promise<ProgressOverview>;
}

export async function createProgressClaimDraft(
  projectId: string,
): Promise<ProgressClaim> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/progress/claims`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to create progress claim');
  }
  return response.json() as Promise<ProgressClaim>;
}

export async function updateProgressClaimDraft(
  projectId: string,
  claimId: string,
  input: {
    note?: string | null;
    lines: Array<{
      trade: string;
      description?: string | null;
      percentComplete: number;
    }>;
  },
): Promise<ProgressClaim> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/progress/claims/${encodeURIComponent(claimId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to update progress claim');
  }
  return response.json() as Promise<ProgressClaim>;
}

export async function submitProgressClaim(
  projectId: string,
  claimId: string,
): Promise<ProgressClaim> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/progress/claims/${encodeURIComponent(claimId)}/submit`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to submit progress claim');
  }
  return response.json() as Promise<ProgressClaim>;
}

export async function approveProgressClaim(
  projectId: string,
  claimId: string,
): Promise<ProgressClaim> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/progress/claims/${encodeURIComponent(claimId)}/approve`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to approve progress claim');
  }
  return response.json() as Promise<ProgressClaim>;
}

export async function rejectProgressClaim(
  projectId: string,
  claimId: string,
  reason?: string,
): Promise<ProgressClaim> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/progress/claims/${encodeURIComponent(claimId)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to reject progress claim');
  }
  return response.json() as Promise<ProgressClaim>;
}
