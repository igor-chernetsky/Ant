import { fetchWithAuth } from './auth-client';
import {
  completeDocumentUpload,
  presignDocumentUpload,
  type ProjectDocument,
} from './documents';

export type DefectStatus =
  | 'reported'
  | 'declined'
  | 'in_progress'
  | 'submitted'
  | 'closed';

export type DefectEventKind =
  | 'created'
  | 'declined'
  | 'accepted'
  | 'resubmitted'
  | 'completed'
  | 'completion_rejected'
  | 'closed';

export interface DefectAttachment {
  id: string;
  projectId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  category: string;
  status: string;
  createdAt: string;
  uploadedAt: string | null;
  hasThumbnail?: boolean;
}

export interface DefectEvent {
  id: string;
  kind: DefectEventKind;
  comment: string | null;
  actorUserId: string;
  actorDisplayName: string | null;
  createdAt: string;
  attachments: DefectAttachment[];
}

export interface Defect {
  id: string;
  projectId: string;
  sequenceNumber: number;
  description: string;
  status: DefectStatus;
  createdAt: string;
  updatedAt: string;
  events: DefectEvent[];
}

export interface DefectsOverview {
  projectId: string;
  role: 'client' | 'contractor' | null;
  isDesignProject: boolean;
  defects: Defect[];
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

export async function fetchProjectDefects(
  projectId: string,
): Promise<DefectsOverview> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/defects`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load defects');
  }
  return response.json() as Promise<DefectsOverview>;
}

export async function createDefect(
  projectId: string,
  description: string,
): Promise<Defect> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/defects`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to report defect');
  }
  return response.json() as Promise<Defect>;
}

export async function deleteDefect(
  projectId: string,
  defectId: string,
): Promise<void> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/defects/${encodeURIComponent(defectId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to delete defect');
  }
}

export async function acceptDefect(
  projectId: string,
  defectId: string,
): Promise<Defect> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/defects/${encodeURIComponent(defectId)}/accept`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to accept defect');
  }
  return response.json() as Promise<Defect>;
}

export async function declineDefect(
  projectId: string,
  defectId: string,
  reason: string,
): Promise<Defect> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/defects/${encodeURIComponent(defectId)}/decline`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to decline defect');
  }
  return response.json() as Promise<Defect>;
}

export async function resubmitDefect(
  projectId: string,
  defectId: string,
  comment?: string,
): Promise<Defect> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/defects/${encodeURIComponent(defectId)}/resubmit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to resubmit defect');
  }
  return response.json() as Promise<Defect>;
}

export async function completeDefect(
  projectId: string,
  defectId: string,
  comment?: string,
): Promise<Defect> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/defects/${encodeURIComponent(defectId)}/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to mark defect complete');
  }
  return response.json() as Promise<Defect>;
}

export async function acceptDefectCompletion(
  projectId: string,
  defectId: string,
): Promise<Defect> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/defects/${encodeURIComponent(defectId)}/accept-completion`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to accept fix');
  }
  return response.json() as Promise<Defect>;
}

export async function rejectDefectCompletion(
  projectId: string,
  defectId: string,
  reason: string,
): Promise<Defect> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/defects/${encodeURIComponent(defectId)}/reject-completion`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to reject fix');
  }
  return response.json() as Promise<Defect>;
}

export async function uploadDefectAttachment(
  projectId: string,
  defectId: string,
  defectEventId: string,
  file: File,
): Promise<ProjectDocument> {
  const presigned = await presignDocumentUpload(projectId, {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    category: file.type.startsWith('image/') ? 'photo' : 'other',
    defectId,
    defectEventId,
  });

  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error(`Upload failed (${putResponse.status})`);
  }

  return completeDocumentUpload(projectId, presigned.documentId);
}

export async function uploadDefectAttachments(
  projectId: string,
  defectId: string,
  defectEventId: string,
  files: File[],
): Promise<void> {
  for (const file of files) {
    await uploadDefectAttachment(projectId, defectId, defectEventId, file);
  }
}
