import { fetchWithAuth } from './auth-client';

export type DocumentCategory =
  | 'blueprint'
  | 'photo'
  | 'specification'
  | 'estimate'
  | 'contract'
  | 'other';

export interface ProjectDocument {
  id: string;
  projectId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  category: DocumentCategory;
  status: string;
  createdAt: string;
  uploadedAt: string | null;
}

export interface PresignUploadInput {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  category?: DocumentCategory;
}

export interface PresignUploadResult {
  documentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export const DOCUMENT_CATEGORY_OPTIONS: Array<{
  value: DocumentCategory;
  label: string;
}> = [
  { value: 'blueprint', label: 'Blueprint / plan' },
  { value: 'photo', label: 'Photo' },
  { value: 'specification', label: 'Specification' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function fetchProjectDocuments(
  projectId: string,
): Promise<ProjectDocument[]> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/documents`,
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load documents');
  }
  return response.json() as Promise<ProjectDocument[]>;
}

export async function presignDocumentUpload(
  projectId: string,
  input: PresignUploadInput,
): Promise<PresignUploadResult> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/documents/presign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to prepare upload');
  }
  return response.json() as Promise<PresignUploadResult>;
}

export async function completeDocumentUpload(
  projectId: string,
  documentId: string,
): Promise<ProjectDocument> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/complete`,
    { method: 'POST' },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to confirm upload');
  }
  return response.json() as Promise<ProjectDocument>;
}

export async function getDocumentDownloadUrl(
  projectId: string,
  documentId: string,
): Promise<{ downloadUrl: string; originalName: string }> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/download-url`,
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to get download link');
  }
  const data = (await response.json()) as {
    downloadUrl: string;
    originalName: string;
  };
  return data;
}

export async function fetchPublicProjectDocuments(
  projectId: string,
): Promise<ProjectDocument[]> {
  const response = await fetch(
    `/api/public/projects/${encodeURIComponent(projectId)}/documents`,
    { cache: 'no-store' },
  );
  if (response.status === 404) {
    throw new Error('NOT_FOUND');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load documents');
  }
  return response.json() as Promise<ProjectDocument[]>;
}

export async function getPublicDocumentDownloadUrl(
  projectId: string,
  documentId: string,
): Promise<{ downloadUrl: string; originalName: string }> {
  const response = await fetch(
    `/api/public/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/download-url`,
    { cache: 'no-store' },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to get download link');
  }
  return response.json() as Promise<{ downloadUrl: string; originalName: string }>;
}

export async function uploadProjectDocument(
  projectId: string,
  file: File,
  category: DocumentCategory = 'other',
): Promise<ProjectDocument> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`);
  }

  const presigned = await presignDocumentUpload(projectId, {
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
    const detail = await putResponse.text().catch(() => '');
    throw new Error(
      `Upload to storage failed (${putResponse.status}). Check S3 CORS and bucket name. ${detail.slice(0, 120)}`,
    );
  }

  return completeDocumentUpload(projectId, presigned.documentId);
}
