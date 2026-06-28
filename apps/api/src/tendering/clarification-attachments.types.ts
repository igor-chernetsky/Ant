import { sanitizeFileName } from '../documents/documents.types';

export interface ClarificationAttachmentResponse {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  uploadedAt: string | null;
}

export interface PresignClarificationAttachmentDto {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignClarificationAttachmentResponse {
  attachmentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface ClarificationAttachmentDownloadResponse {
  downloadUrl: string;
  expiresInSeconds: number;
  originalName: string;
  contentType: string;
}

export const MAX_CLARIFICATION_ATTACHMENTS_PER_QUESTION = 10;

export function buildClarificationAttachmentStorageKey(
  projectId: string,
  questionId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `projects/${projectId}/clarifications/${questionId}/${attachmentId}/${sanitizeFileName(fileName)}`;
}
