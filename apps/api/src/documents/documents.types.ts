import { DocumentCategory } from '@prisma/client';

export interface PresignUploadDto {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  category?: DocumentCategory;
}

export interface DocumentResponse {
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

export interface PresignUploadResponse {
  documentId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresInSeconds: number;
  originalName: string;
  contentType: string;
}

export const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
]);

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, '_').trim();
  const cleaned = base.replace(/[^\w.\-() ]+/g, '_').slice(0, 200);
  return cleaned || 'file';
}

export function buildStorageKey(
  projectId: string,
  documentId: string,
  fileName: string,
): string {
  return `projects/${projectId}/documents/${documentId}/${sanitizeFileName(fileName)}`;
}
