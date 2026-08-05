import { fetchWithAuth } from './auth-client';
import {
  assertCustomContractFile,
  MAX_CUSTOM_CONTRACT_BYTES,
} from './contracts';
import { MAX_UPLOAD_BYTES } from './documents';
import type { Locale } from './i18n';

export type ContractAddendumStatus = 'pending_signatures' | 'fully_signed';

export interface ContractAddendumCustomFile {
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  uploadedAt: string;
}

export interface ContractAddendumAttachment {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  uploadedAt: string | null;
}

export interface ContractAddendum {
  id: string;
  contractId: string;
  projectId: string;
  title: string;
  sourceDescription: string | null;
  englishBodyHtml: string | null;
  bodyLocale: Locale;
  status: ContractAddendumStatus;
  contractorSignedAt: string | null;
  clientSignedAt: string | null;
  hasContractorSignature: boolean;
  hasClientSignature: boolean;
  contractorSignatureDataUrl: string | null;
  clientSignatureDataUrl: string | null;
  hasCustomFile: boolean;
  customFile: ContractAddendumCustomFile | null;
  attachments: ContractAddendumAttachment[];
  canEditDocument: boolean;
  canReplaceFile: boolean;
  canManageAttachments: boolean;
  canDelete: boolean;
  canSign: boolean;
  fullySigned: boolean;
  createdAt: string;
  updatedAt: string;
}

export const MAX_ADDENDUM_FILE_BYTES = MAX_CUSTOM_CONTRACT_BYTES;
export const MAX_ADDENDUM_ATTACHMENT_BYTES = MAX_UPLOAD_BYTES;

function addendaBase(projectId: string, asContractor: boolean): string {
  return asContractor
    ? `/api/contractor/projects/${encodeURIComponent(projectId)}/contract/addenda`
    : `/api/projects/${encodeURIComponent(projectId)}/contract/addenda`;
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  throw new Error(body?.message ?? fallback);
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? null;
}

export async function listContractAddenda(
  projectId: string,
  options?: { asContractor?: boolean },
): Promise<ContractAddendum[]> {
  const response = await fetchWithAuth(
    addendaBase(projectId, Boolean(options?.asContractor)),
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load additional agreements');
  }
  return response.json() as Promise<ContractAddendum[]>;
}

export async function deleteContractAddendum(
  projectId: string,
  addendumId: string,
  options?: { asContractor?: boolean },
): Promise<void> {
  const response = await fetchWithAuth(
    `${addendaBase(projectId, Boolean(options?.asContractor))}/${encodeURIComponent(addendumId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to delete additional agreement');
  }
}

export async function createAddendumFromText(
  projectId: string,
  input: { description: string; title?: string; locale?: Locale },
  options?: { asContractor?: boolean },
): Promise<ContractAddendum> {
  const response = await fetchWithAuth(
    `${addendaBase(projectId, Boolean(options?.asContractor))}/from-text`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to create additional agreement');
  }
  return response.json() as Promise<ContractAddendum>;
}

export async function createAddendumFromFile(
  projectId: string,
  file: File,
  options?: { asContractor?: boolean; title?: string },
): Promise<ContractAddendum> {
  const asContractor = Boolean(options?.asContractor);
  const contentType = assertCustomContractFile(file);
  const base = addendaBase(projectId, asContractor);

  const presignResponse = await fetchWithAuth(`${base}/from-file/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    }),
  });
  if (!presignResponse.ok) {
    await parseError(presignResponse, 'Failed to prepare upload');
  }
  const presigned = (await presignResponse.json()) as {
    addendumId: string;
    uploadUrl: string;
    storageKey: string;
  };

  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error('Upload to storage failed');
  }

  const completeResponse = await fetchWithAuth(`${base}/from-file/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      addendumId: presigned.addendumId,
      storageKey: presigned.storageKey,
      originalName: file.name,
      contentType,
      sizeBytes: file.size,
      title: options?.title,
    }),
  });
  if (!completeResponse.ok) {
    await parseError(completeResponse, 'Failed to create additional agreement');
  }
  return completeResponse.json() as Promise<ContractAddendum>;
}

export async function updateAddendumDocument(
  projectId: string,
  addendumId: string,
  englishBodyHtml: string,
  options?: { asContractor?: boolean },
): Promise<ContractAddendum> {
  const response = await fetchWithAuth(
    `${addendaBase(projectId, Boolean(options?.asContractor))}/${encodeURIComponent(addendumId)}/document`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ englishBodyHtml }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to save additional agreement');
  }
  return response.json() as Promise<ContractAddendum>;
}

export async function regenerateAddendumDocument(
  projectId: string,
  addendumId: string,
  options?: { asContractor?: boolean; locale?: Locale },
): Promise<ContractAddendum> {
  const response = await fetchWithAuth(
    `${addendaBase(projectId, Boolean(options?.asContractor))}/${encodeURIComponent(addendumId)}/document/regenerate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: options?.locale }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to regenerate additional agreement');
  }
  return response.json() as Promise<ContractAddendum>;
}

export async function uploadAddendumCustomFile(
  projectId: string,
  addendumId: string,
  file: File,
  options?: { asContractor?: boolean },
): Promise<ContractAddendum> {
  const asContractor = Boolean(options?.asContractor);
  const contentType = assertCustomContractFile(file);
  const base = `${addendaBase(projectId, asContractor)}/${encodeURIComponent(addendumId)}`;

  const presignResponse = await fetchWithAuth(`${base}/custom-file/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    }),
  });
  if (!presignResponse.ok) {
    await parseError(presignResponse, 'Failed to prepare upload');
  }
  const presigned = (await presignResponse.json()) as {
    uploadUrl: string;
    storageKey: string;
  };

  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error('Upload to storage failed');
  }

  const completeResponse = await fetchWithAuth(`${base}/custom-file/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storageKey: presigned.storageKey,
      originalName: file.name,
      contentType,
      sizeBytes: file.size,
    }),
  });
  if (!completeResponse.ok) {
    await parseError(completeResponse, 'Failed to upload file');
  }
  return completeResponse.json() as Promise<ContractAddendum>;
}

export async function downloadAddendumCustomFile(
  projectId: string,
  addendumId: string,
  options?: { asContractor?: boolean },
): Promise<void> {
  const response = await fetchWithAuth(
    `${addendaBase(projectId, Boolean(options?.asContractor))}/${encodeURIComponent(addendumId)}/custom-file`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to get download link');
  }
  const data = (await response.json()) as {
    downloadUrl: string;
    originalName: string;
  };
  const anchor = document.createElement('a');
  anchor.href = data.downloadUrl;
  anchor.download = data.originalName || 'addendum';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function addendumCustomFilePreviewPath(
  projectId: string,
  addendumId: string,
  asContractor: boolean,
): string {
  return `${addendaBase(projectId, asContractor)}/${encodeURIComponent(addendumId)}/custom-file/preview`;
}

export async function signContractAddendum(
  projectId: string,
  addendumId: string,
  options?: { asContractor?: boolean; signatureDataUrl?: string | null },
): Promise<ContractAddendum> {
  const response = await fetchWithAuth(
    `${addendaBase(projectId, Boolean(options?.asContractor))}/${encodeURIComponent(addendumId)}/sign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signatureDataUrl: options?.signatureDataUrl ?? null,
      }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to sign additional agreement');
  }
  return response.json() as Promise<ContractAddendum>;
}

export async function uploadAddendumAttachment(
  projectId: string,
  addendumId: string,
  file: File,
  options?: { asContractor?: boolean },
): Promise<ContractAddendumAttachment> {
  if (file.size < 1 || file.size > MAX_ADDENDUM_ATTACHMENT_BYTES) {
    throw new Error(
      `File exceeds ${MAX_ADDENDUM_ATTACHMENT_BYTES / (1024 * 1024)} MB limit`,
    );
  }
  const contentType =
    file.type?.trim() || 'application/octet-stream';
  const asContractor = Boolean(options?.asContractor);
  const base = `${addendaBase(projectId, asContractor)}/${encodeURIComponent(addendumId)}`;

  const presignResponse = await fetchWithAuth(`${base}/attachments/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    }),
  });
  if (!presignResponse.ok) {
    await parseError(presignResponse, 'Failed to prepare attachment upload');
  }
  const presigned = (await presignResponse.json()) as {
    attachmentId: string;
    uploadUrl: string;
  };

  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error('Upload to storage failed');
  }

  const completeResponse = await fetchWithAuth(
    `${base}/attachments/${encodeURIComponent(presigned.attachmentId)}/complete`,
    { method: 'POST' },
  );
  if (!completeResponse.ok) {
    await parseError(completeResponse, 'Failed to confirm attachment');
  }
  return completeResponse.json() as Promise<ContractAddendumAttachment>;
}

export async function deleteAddendumAttachment(
  projectId: string,
  addendumId: string,
  attachmentId: string,
  options?: { asContractor?: boolean },
): Promise<void> {
  const response = await fetchWithAuth(
    `${addendaBase(projectId, Boolean(options?.asContractor))}/${encodeURIComponent(addendumId)}/attachments/${encodeURIComponent(attachmentId)}/delete`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to delete attachment');
  }
}

export async function downloadAddendumAttachment(
  projectId: string,
  addendumId: string,
  attachmentId: string,
  options?: { asContractor?: boolean },
): Promise<void> {
  const response = await fetchWithAuth(
    `${addendaBase(projectId, Boolean(options?.asContractor))}/${encodeURIComponent(addendumId)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to get download link');
  }
  const data = (await response.json()) as {
    downloadUrl: string;
    originalName: string;
  };
  const anchor = document.createElement('a');
  anchor.href = data.downloadUrl;
  anchor.download = data.originalName || 'attachment';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function downloadContractAddendum(
  projectId: string,
  addendumId: string,
  options?: { asContractor?: boolean; withAttachments?: boolean },
): Promise<void> {
  const params = new URLSearchParams();
  if (options?.withAttachments) {
    params.set('withAttachments', '1');
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(
    `${addendaBase(projectId, Boolean(options?.asContractor))}/${encodeURIComponent(addendumId)}/download${query}`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to download additional agreement');
  }
  const blob = await response.blob();
  const fileName =
    parseContentDispositionFilename(
      response.headers.get('content-disposition'),
    ) ?? `addendum-${addendumId.slice(0, 8)}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
