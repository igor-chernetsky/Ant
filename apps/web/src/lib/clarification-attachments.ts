import { fetchWithAuth } from './auth-client';
import { MAX_UPLOAD_BYTES } from './documents';

export interface ClarificationAttachment {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  uploadedAt: string | null;
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  throw new Error(body?.message ?? fallback);
}

export async function presignClarificationAttachment(
  projectId: string,
  questionId: string,
  input: { fileName: string; contentType: string; sizeBytes: number },
): Promise<{
  attachmentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/clarification-questions/${encodeURIComponent(questionId)}/attachments/presign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to prepare upload');
  }
  return response.json() as Promise<{
    attachmentId: string;
    uploadUrl: string;
    storageKey: string;
    expiresInSeconds: number;
  }>;
}

export async function completeClarificationAttachment(
  projectId: string,
  questionId: string,
  attachmentId: string,
): Promise<ClarificationAttachment> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/clarification-questions/${encodeURIComponent(questionId)}/attachments/${encodeURIComponent(attachmentId)}/complete`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to confirm upload');
  }
  return response.json() as Promise<ClarificationAttachment>;
}

export async function deleteClarificationAttachment(
  projectId: string,
  questionId: string,
  attachmentId: string,
): Promise<void> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/clarification-questions/${encodeURIComponent(questionId)}/attachments/${encodeURIComponent(attachmentId)}/delete`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to delete attachment');
  }
}

export async function getClarificationAttachmentDownloadUrl(
  projectId: string,
  questionId: string,
  attachmentId: string,
): Promise<{ downloadUrl: string; originalName: string }> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/clarification-questions/${encodeURIComponent(questionId)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to get download link');
  }
  return response.json() as Promise<{ downloadUrl: string; originalName: string }>;
}

export interface ContractorClarificationAttachmentQuestion {
  id: string;
  questionText: string;
  attachments: ClarificationAttachment[];
}

export async function fetchContractorClarificationAttachments(
  projectId: string,
): Promise<{ questions: ContractorClarificationAttachmentQuestion[] }> {
  const response = await fetchWithAuth(
    `/api/contractor/projects/${encodeURIComponent(projectId)}/clarification-attachments`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load clarification attachments');
  }
  return response.json() as Promise<{
    questions: ContractorClarificationAttachmentQuestion[];
  }>;
}

export async function getContractorClarificationAttachmentDownloadUrl(
  projectId: string,
  questionId: string,
  attachmentId: string,
): Promise<{ downloadUrl: string; originalName: string }> {
  const response = await fetchWithAuth(
    `/api/contractor/projects/${encodeURIComponent(projectId)}/clarification-questions/${encodeURIComponent(questionId)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to get download link');
  }
  return response.json() as Promise<{ downloadUrl: string; originalName: string }>;
}

export async function uploadClarificationAttachment(
  projectId: string,
  questionId: string,
  file: File,
): Promise<ClarificationAttachment> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`);
  }

  const presigned = await presignClarificationAttachment(projectId, questionId, {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  });

  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  if (!putResponse.ok) {
    const detail = await putResponse.text().catch(() => '');
    throw new Error(
      `Upload to storage failed (${putResponse.status}). ${detail.slice(0, 120)}`,
    );
  }

  return completeClarificationAttachment(
    projectId,
    questionId,
    presigned.attachmentId,
  );
}
