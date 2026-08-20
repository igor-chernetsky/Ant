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

export interface ProgressPaymentSlip {
  id: string;
  documentId: string;
  originalName: string;
  uploadedAt: string;
  status: 'draft' | 'submitted';
  submittedAt: string | null;
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
  retentionPercent: number;
  retentionPeriod: number;
  payablePeriod: number;
  paymentSlips: ProgressPaymentSlip[];
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
  retentionPercent: number;
  retentionLimitPercent: number;
  retentionHeldToDate: number;
  advancePaymentPercent: number;
  advancePaymentAmount: number;
  advancePaymentSlips: ProgressPaymentSlip[];
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

async function uploadPaymentSlipFile(
  presignUrl: string,
  completeUrl: string,
  file: File,
): Promise<Response> {
  const presignResponse = await fetchWithAuth(presignUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });
  if (!presignResponse.ok) {
    await parseError(presignResponse, 'Failed to prepare payment slip upload');
  }
  const presigned = (await presignResponse.json()) as {
    documentId: string;
    uploadUrl: string;
  };
  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error('Failed to upload payment slip file');
  }
  return fetchWithAuth(completeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: presigned.documentId }),
  });
}

export async function attachProgressClaimPaymentSlip(
  projectId: string,
  claimId: string,
  file: File,
): Promise<ProgressClaim> {
  const completeResponse = await uploadPaymentSlipFile(
    `/api/projects/${encodeURIComponent(projectId)}/progress/claims/${encodeURIComponent(claimId)}/payment-slip/presign`,
    `/api/projects/${encodeURIComponent(projectId)}/progress/claims/${encodeURIComponent(claimId)}/payment-slip/complete`,
    file,
  );
  if (!completeResponse.ok) {
    await parseError(completeResponse, 'Failed to attach payment slip');
  }
  return completeResponse.json() as Promise<ProgressClaim>;
}

export async function attachProgressClaimPaymentSlips(
  projectId: string,
  claimId: string,
  files: File[],
): Promise<ProgressClaim | null> {
  let last: ProgressClaim | null = null;
  for (const file of files) {
    last = await attachProgressClaimPaymentSlip(projectId, claimId, file);
  }
  return last;
}

export async function deleteProgressClaimPaymentSlip(
  projectId: string,
  claimId: string,
  attachmentId: string,
): Promise<ProgressClaim> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/progress/claims/${encodeURIComponent(claimId)}/payment-slips/${encodeURIComponent(attachmentId)}/delete`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to delete payment slip');
  }
  return response.json() as Promise<ProgressClaim>;
}

export async function submitProgressClaimPaymentSlips(
  projectId: string,
  claimId: string,
): Promise<ProgressClaim> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/progress/claims/${encodeURIComponent(claimId)}/payment-slips/submit`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to send payment slips');
  }
  return response.json() as Promise<ProgressClaim>;
}

export async function attachAdvancePaymentSlip(
  projectId: string,
  file: File,
): Promise<ProgressOverview> {
  const completeResponse = await uploadPaymentSlipFile(
    `/api/projects/${encodeURIComponent(projectId)}/progress/advance-payment-slip/presign`,
    `/api/projects/${encodeURIComponent(projectId)}/progress/advance-payment-slip/complete`,
    file,
  );
  if (!completeResponse.ok) {
    await parseError(completeResponse, 'Failed to attach advance payment slip');
  }
  return completeResponse.json() as Promise<ProgressOverview>;
}

export async function attachAdvancePaymentSlips(
  projectId: string,
  files: File[],
): Promise<ProgressOverview | null> {
  let last: ProgressOverview | null = null;
  for (const file of files) {
    last = await attachAdvancePaymentSlip(projectId, file);
  }
  return last;
}

export async function deleteAdvancePaymentSlip(
  projectId: string,
  attachmentId: string,
): Promise<ProgressOverview> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/progress/advance-payment-slips/${encodeURIComponent(attachmentId)}/delete`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to delete payment slip');
  }
  return response.json() as Promise<ProgressOverview>;
}

export async function submitAdvancePaymentSlips(
  projectId: string,
): Promise<ProgressOverview> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/progress/advance-payment-slips/submit`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to send payment slips');
  }
  return response.json() as Promise<ProgressOverview>;
}

export async function getProgressDocumentDownloadUrl(
  projectId: string,
  documentId: string,
): Promise<{ downloadUrl: string; originalName: string }> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/download-url`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to get download link');
  }
  return response.json() as Promise<{ downloadUrl: string; originalName: string }>;
}
