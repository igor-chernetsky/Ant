import { sanitizeFileName } from '../documents/documents.types';

export interface PresignPortfolioItemDto {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  title?: string;
}

export interface UpdatePortfolioItemDto {
  title?: string;
}

export interface PortfolioItemResponse {
  id: string;
  contractorId: string;
  title: string;
  description: string | null;
  originalName: string;
  contentType: string;
  sizeBytes: number | null;
  status: string;
  sortOrder: number;
  createdAt: string;
  uploadedAt: string | null;
  hasThumbnail: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
}

export const ALLOWED_PORTFOLIO_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const MAX_PORTFOLIO_ITEMS = 40;
export const MAX_PORTFOLIO_UPLOAD_BYTES = 25 * 1024 * 1024;

export function buildPortfolioStorageKey(
  contractorId: string,
  itemId: string,
  fileName: string,
): string {
  const safe = sanitizeFileName(fileName);
  return `contractors/${contractorId}/portfolio/${itemId}/${safe}`;
}

export function buildPortfolioThumbnailKey(
  contractorId: string,
  itemId: string,
): string {
  return `contractors/${contractorId}/portfolio/${itemId}/thumb.jpg`;
}
