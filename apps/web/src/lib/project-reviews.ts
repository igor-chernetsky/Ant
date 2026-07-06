import { fetchWithAuth } from './auth-client';

export const REVIEW_RATING_CATEGORIES = [
  { key: 'quality', label: 'Quality of work' },
  { key: 'timeline', label: 'Timeline adherence' },
  { key: 'communication', label: 'Communication' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'value', label: 'Value for money' },
  { key: 'siteConduct', label: 'Site conduct & cleanliness' },
] as const;

export type ReviewRatingCategory =
  (typeof REVIEW_RATING_CATEGORIES)[number]['key'];

export type ReviewRatings = Record<ReviewRatingCategory, number>;

export const MAX_REVIEW_ATTACHMENTS = 10;
export const MAX_REVIEW_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface ProjectCompletionContext {
  canComplete: boolean;
  contractorName: string | null;
  reason: string | null;
}

export interface CompleteProjectInput {
  comment?: string;
  ratings: ReviewRatings;
  attachmentIds?: string[];
}

export interface ReviewAttachmentUpload {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
}

export function canCompleteProject(project: { status: string }): boolean {
  return project.status === 'active';
}

export async function fetchProjectCompletionContext(
  projectId: string,
): Promise<ProjectCompletionContext> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/completion`,
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load completion details');
  }
  return response.json() as Promise<ProjectCompletionContext>;
}

export async function presignReviewAttachment(
  projectId: string,
  input: { fileName: string; contentType: string; sizeBytes: number },
): Promise<{
  attachmentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/review-attachments/presign`,
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
    throw new Error(body?.message ?? 'Failed to prepare file upload');
  }
  return response.json() as Promise<{
    attachmentId: string;
    uploadUrl: string;
    storageKey: string;
    expiresInSeconds: number;
  }>;
}

export async function completeReviewAttachment(
  projectId: string,
  attachmentId: string,
): Promise<ReviewAttachmentUpload> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/review-attachments/${encodeURIComponent(attachmentId)}/complete`,
    { method: 'POST' },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to complete file upload');
  }
  return response.json() as Promise<ReviewAttachmentUpload>;
}

export async function uploadReviewAttachment(
  projectId: string,
  file: File,
): Promise<ReviewAttachmentUpload> {
  const presigned = await presignReviewAttachment(projectId, {
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });

  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file');
  }

  return completeReviewAttachment(projectId, presigned.attachmentId);
}
