import { DocumentCategory } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

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

/** Reject completed uploads that exceed size or use a disallowed MIME. */
export function assertCompletedUploadLimits(input: {
  sizeBytes: number;
  contentType?: string | null;
  maxBytes?: number;
  allowedContentTypes?: Set<string>;
}): void {
  const maxBytes = input.maxBytes ?? MAX_UPLOAD_BYTES;
  const allowed = input.allowedContentTypes ?? ALLOWED_CONTENT_TYPES;
  if (
    !Number.isFinite(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > maxBytes
  ) {
    throw new BadRequestException(
      `Uploaded file size must be between 1 byte and ${maxBytes} bytes`,
    );
  }
  const contentType = input.contentType?.trim().toLowerCase();
  if (contentType && !allowed.has(contentType)) {
    throw new BadRequestException('Uploaded file content type is not allowed');
  }
}

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

/**
 * Ownership / rent papers for bidders to review — not used for AI project card analysis.
 * `estimate` kept for legacy uploads that should also skip analysis.
 */
export const REFERENCE_ONLY_DOCUMENT_CATEGORIES: ReadonlySet<DocumentCategory> =
  new Set([
    DocumentCategory.ownership_certificate,
    DocumentCategory.owners_id,
    DocumentCategory.contract,
    DocumentCategory.estimate,
  ]);

export function isReferenceOnlyDocumentCategory(
  category: DocumentCategory | string,
): boolean {
  return REFERENCE_ONLY_DOCUMENT_CATEGORIES.has(category as DocumentCategory);
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
