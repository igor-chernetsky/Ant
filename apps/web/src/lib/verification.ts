export type ContractorVerificationStatus =
  | 'pending'
  | 'awaiting_review'
  | 'verified'
  | 'rejected'
  | 'suspended';

export type ContractorVerificationDocCategory =
  | 'business_license'
  | 'registration'
  | 'insurance'
  | 'portfolio'
  | 'other';

export interface ContractorVerificationDocument {
  id: string;
  contractorId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  category: ContractorVerificationDocCategory;
  status: string;
  createdAt: string;
  uploadedAt: string | null;
}

export interface AdminContractorListItem {
  id: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  companyName: string | null;
  regionCode: string;
  verificationStatus: ContractorVerificationStatus;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  verificationComment: string | null;
  documentCount: number;
  createdAt: string;
}

export interface AdminContractorDetail extends AdminContractorListItem {
  projectTypes: string[];
  documents: ContractorVerificationDocument[];
}

export const VERIFICATION_DOC_CATEGORIES: Array<{
  value: ContractorVerificationDocCategory;
  label: string;
}> = [
  { value: 'business_license', label: 'Business license' },
  { value: 'registration', label: 'Company registration' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'portfolio', label: 'Portfolio / references' },
  { value: 'other', label: 'Other' },
];

export const MAX_VERIFICATION_UPLOAD_BYTES = 25 * 1024 * 1024;

async function parseError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = body?.message;
  if (Array.isArray(message)) {
    throw new Error(message.join(', '));
  }
  throw new Error(typeof message === 'string' ? message : fallback);
}

export function isAdmin(roles: string[]): boolean {
  return roles.includes('admin');
}

export function formatVerificationStatus(status: string): string {
  return status.replaceAll('_', ' ');
}

export async function fetchVerificationDocuments(): Promise<
  ContractorVerificationDocument[]
> {
  const response = await fetch('/api/contractor/verification/documents', {
    credentials: 'include',
  });
  if (response.status === 401) throw new Error('NOT_AUTHENTICATED');
  if (!response.ok) {
    await parseError(response, 'Failed to load documents');
  }
  return response.json() as Promise<ContractorVerificationDocument[]>;
}

export async function presignVerificationDocument(input: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  category?: ContractorVerificationDocCategory;
}) {
  const response = await fetch('/api/contractor/verification/documents/presign', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to prepare upload');
  }
  return response.json() as Promise<{
    documentId: string;
    uploadUrl: string;
  }>;
}

export async function completeVerificationDocument(documentId: string) {
  const response = await fetch(
    `/api/contractor/verification/documents/${encodeURIComponent(documentId)}/complete`,
    { method: 'POST', credentials: 'include' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to confirm upload');
  }
  return response.json() as Promise<ContractorVerificationDocument>;
}

export async function getVerificationDocumentDownloadUrl(documentId: string) {
  const response = await fetch(
    `/api/contractor/verification/documents/${encodeURIComponent(documentId)}/download-url`,
    { credentials: 'include' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to get download link');
  }
  return response.json() as Promise<{ downloadUrl: string; originalName: string }>;
}

export async function requestContractorApproval() {
  const response = await fetch('/api/contractor/verification/request-approval', {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    await parseError(response, 'Failed to request approval');
  }
  return response.json();
}

export async function uploadVerificationDocument(
  file: File,
  category: ContractorVerificationDocCategory = 'other',
): Promise<ContractorVerificationDocument> {
  if (file.size > MAX_VERIFICATION_UPLOAD_BYTES) {
    throw new Error('File exceeds 25 MB limit');
  }
  const presigned = await presignVerificationDocument({
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    category,
  });
  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error('Upload to storage failed');
  }
  return completeVerificationDocument(presigned.documentId);
}

export async function fetchAdminContractors(
  status?: ContractorVerificationStatus,
): Promise<AdminContractorListItem[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await fetch(`/api/admin/contractors${qs}`, {
    credentials: 'include',
  });
  if (response.status === 401) throw new Error('NOT_AUTHENTICATED');
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) {
    await parseError(response, 'Failed to load contractors');
  }
  return response.json() as Promise<AdminContractorListItem[]>;
}

export async function fetchAdminContractor(
  contractorId: string,
): Promise<AdminContractorDetail> {
  const response = await fetch(
    `/api/admin/contractors/${encodeURIComponent(contractorId)}`,
    { credentials: 'include' },
  );
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) {
    await parseError(response, 'Failed to load contractor');
  }
  return response.json() as Promise<AdminContractorDetail>;
}

export async function approveAdminContractor(contractorId: string) {
  const response = await fetch(
    `/api/admin/contractors/${encodeURIComponent(contractorId)}/approve`,
    { method: 'POST', credentials: 'include' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to approve contractor');
  }
  return response.json();
}

export async function rejectAdminContractor(
  contractorId: string,
  comment: string,
) {
  const response = await fetch(
    `/api/admin/contractors/${encodeURIComponent(contractorId)}/reject`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to reject contractor');
  }
  return response.json();
}

export async function getAdminContractorDocumentUrl(
  contractorId: string,
  documentId: string,
) {
  const response = await fetch(
    `/api/admin/contractors/${encodeURIComponent(contractorId)}/documents/${encodeURIComponent(documentId)}/download-url`,
    { credentials: 'include' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to get document link');
  }
  return response.json() as Promise<{ downloadUrl: string; originalName: string }>;
}
