import { fetchWithAuth } from './auth-client';

export type ContractorVerificationStatus =
  | 'pending'
  | 'no_profile'
  | 'awaiting_review'
  | 'verified'
  | 'rejected'
  | 'suspended';

export type SupplyProfileKind = 'contractor' | 'designer';

export type ContractorVerificationDocCategory =
  | 'business_license'
  | 'registration'
  | 'insurance'
  | 'owners_id'
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
  phone: string | null;
  taxId: string | null;
  preferredContactMethods: Array<'phone' | 'line' | 'whatsapp' | 'email'>;
  bankName: string | null;
  bankAccount: string | null;
  regionCode: string | null;
  kind: SupplyProfileKind;
  verificationStatus: ContractorVerificationStatus;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  verificationComment: string | null;
  documentCount: number;
  createdAt: string;
  hasProfile: boolean;
}

/** A trade the company asked to be listed for, resolved to a readable label. */
export interface AdminContractorTrade {
  slug: string;
  label: string;
  groupLabel: string | null;
}

/** A service area the company covers, resolved to a readable label. */
export interface AdminContractorLocation {
  regionSlug: string;
  areaSlug: string | null;
  /** `"Area, Region"`, or just the region when the whole region is covered. */
  label: string;
}

export interface AdminContractorDetail extends AdminContractorListItem {
  projectTypes: string[];
  tagSlugs?: string[];
  /** Trades requested by the company, in the order they selected them. */
  trades?: AdminContractorTrade[];
  /** Regions/areas the company covers, in the order they selected them. */
  serviceLocations?: AdminContractorLocation[];
  documents: ContractorVerificationDocument[];
}

export const VERIFICATION_DOC_CATEGORIES: Array<{
  value: ContractorVerificationDocCategory;
  label: string;
}> = [
  { value: 'business_license', label: 'Business license' },
  { value: 'registration', label: 'Company registration' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'owners_id', label: "Owner's ID" },
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
  const response = await fetchWithAuth('/api/contractor/verification/documents');
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
  const response = await fetchWithAuth('/api/contractor/verification/documents/presign', {
    method: 'POST',
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
  const response = await fetchWithAuth(
    `/api/contractor/verification/documents/${encodeURIComponent(documentId)}/complete`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to confirm upload');
  }
  return response.json() as Promise<ContractorVerificationDocument>;
}

export async function getVerificationDocumentDownloadUrl(documentId: string) {
  const response = await fetchWithAuth(
    `/api/contractor/verification/documents/${encodeURIComponent(documentId)}/download-url`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to get download link');
  }
  return response.json() as Promise<{ downloadUrl: string; originalName: string }>;
}

export async function requestContractorApproval() {
  const response = await fetchWithAuth('/api/contractor/verification/request-approval', {
    method: 'POST',
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
  const contentType = resolveVerificationContentType(file);
  const presigned = await presignVerificationDocument({
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
    category,
  });
  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error('Upload to storage failed');
  }
  return completeVerificationDocument(presigned.documentId);
}

function resolveVerificationContentType(file: File): string {
  const typed = file.type?.trim().toLowerCase();
  if (typed && typed !== 'application/octet-stream') {
    return typed;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (lower.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  return typed || 'application/octet-stream';
}

export async function fetchAdminContractors(
  status?: ContractorVerificationStatus,
  options?: { includeNoProfile?: boolean },
): Promise<AdminContractorListItem[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (options?.includeNoProfile) params.set('includeNoProfile', '1');
  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(`/api/admin/contractors${qs}`);
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) {
    await parseError(response, 'Failed to load contractors');
  }
  return response.json() as Promise<AdminContractorListItem[]>;
}

export async function fetchAdminContractor(
  contractorId: string,
): Promise<AdminContractorDetail> {
  const response = await fetchWithAuth(
    `/api/admin/contractors/${encodeURIComponent(contractorId)}`,
  );
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) {
    await parseError(response, 'Failed to load contractor');
  }
  return response.json() as Promise<AdminContractorDetail>;
}

export async function approveAdminContractor(contractorId: string) {
  const response = await fetchWithAuth(
    `/api/admin/contractors/${encodeURIComponent(contractorId)}/approve`,
    { method: 'POST' },
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
  const response = await fetchWithAuth(
    `/api/admin/contractors/${encodeURIComponent(contractorId)}/reject`,
    {
      method: 'POST',
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
  const response = await fetchWithAuth(
    `/api/admin/contractors/${encodeURIComponent(contractorId)}/documents/${encodeURIComponent(documentId)}/download-url`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to get document link');
  }
  return response.json() as Promise<{ downloadUrl: string; originalName: string }>;
}

export interface AdminAccountDeleteResult {
  ok: true;
  deletedAt: string | null;
  keycloakRemoved: boolean;
  keycloakMessage: string | null;
}

/** Soft-delete the account behind a supply profile (Keycloak identity removed). */
export async function deleteAdminContractor(
  contractorId: string,
): Promise<AdminAccountDeleteResult> {
  const response = await fetchWithAuth(
    `/api/admin/contractors/${encodeURIComponent(contractorId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to delete the account');
  }
  return response.json() as Promise<AdminAccountDeleteResult>;
}

export interface AdminSupplyRoleSyncResult {
  ok: true;
  candidates: number;
  granted: string[];
  skipped: string[];
  failed: Array<{ email: string | null; message: string }>;
}

/** Grant the missing realm role to supply profiles created before it was required. */
export async function syncAdminSupplyRoles(): Promise<AdminSupplyRoleSyncResult> {
  const response = await fetchWithAuth('/api/admin/contractors/sync-roles', {
    method: 'POST',
  });
  if (!response.ok) {
    await parseError(response, 'Failed to sync supply roles');
  }
  return response.json() as Promise<AdminSupplyRoleSyncResult>;
}
