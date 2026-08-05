import { fetchWithAuth } from './auth-client';

export type SignatureRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SignatureRequestListItem {
  id: string;
  status: SignatureRequestStatus;
  projectId: string;
  projectTitle: string;
  contractId: string;
  contractorId: string;
  companyName: string | null;
  contractorEmail: string | null;
  bankName: string | null;
  bankAccount: string | null;
  currency: string;
  contractAmount: number | null;
  accessFeeUsd: number;
  dueNowListed: number | null;
  dueNowPayable: number;
  successFeeGross: number | null;
  trialActive: boolean;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = Array.isArray(body?.message)
    ? body.message.join(', ')
    : body?.message;
  throw new Error(message ?? fallback);
}

export async function createContractSignatureRequest(
  projectId: string,
): Promise<SignatureRequestListItem> {
  const response = await fetchWithAuth(
    `/api/contractor/projects/${encodeURIComponent(projectId)}/contract/signature-request`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to submit signature request');
  }
  return response.json() as Promise<SignatureRequestListItem>;
}

export async function fetchAdminSignatureRequests(
  status?: SignatureRequestStatus | '',
): Promise<SignatureRequestListItem[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await fetchWithAuth(`/api/admin/signature-requests${qs}`);
  if (!response.ok) {
    await parseError(response, 'Failed to load signature requests');
  }
  return response.json() as Promise<SignatureRequestListItem[]>;
}

export async function approveAdminSignatureRequest(
  requestId: string,
): Promise<SignatureRequestListItem> {
  const response = await fetchWithAuth(
    `/api/admin/signature-requests/${encodeURIComponent(requestId)}/approve`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to approve request');
  }
  return response.json() as Promise<SignatureRequestListItem>;
}

export async function rejectAdminSignatureRequest(
  requestId: string,
  reason: string,
): Promise<SignatureRequestListItem> {
  const response = await fetchWithAuth(
    `/api/admin/signature-requests/${encodeURIComponent(requestId)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to reject request');
  }
  return response.json() as Promise<SignatureRequestListItem>;
}
