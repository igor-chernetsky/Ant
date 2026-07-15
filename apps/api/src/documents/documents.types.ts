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
  hasThumbnail?: boolean;
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

export function buildDocumentThumbnailKey(
  projectId: string,
  documentId: string,
): string {
  return `projects/${projectId}/documents/${documentId}/thumb.jpg`;
}

export type DocumentDownloadVariant = 'original' | 'thumb';

export function parseDocumentDownloadVariant(
  value: string | undefined | null,
): DocumentDownloadVariant {
  return value === 'thumb' ? 'thumb' : 'original';
}

export function inferDocumentCategory(
  contentType: string,
  fileName: string,
): DocumentCategory {
  if (contentType.startsWith('image/')) {
    return 'photo';
  }
  if (
    /\b(plan|drawing|blueprint|чертёж|чертеж|схем|план)/i.test(fileName)
  ) {
    return 'blueprint';
  }
  if (
    contentType === 'application/pdf' ||
    contentType.includes('word') ||
    contentType.includes('sheet') ||
    contentType === 'text/plain'
  ) {
    return 'specification';
  }
  return 'other';
}
