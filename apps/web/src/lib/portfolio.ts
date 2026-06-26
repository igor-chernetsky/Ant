import { fetchWithAuth } from './auth-client';

export interface PortfolioItem {
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

export const MAX_PORTFOLIO_UPLOAD_BYTES = 25 * 1024 * 1024;

const PORTFOLIO_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

async function parseError(response: Response, fallback: string): Promise<never> {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = body?.message;
  if (Array.isArray(message)) {
    throw new Error(message.join(', '));
  }
  throw new Error(typeof message === 'string' ? message : fallback);
}

export function guessPortfolioContentType(file: File): string | null {
  if (file.type && PORTFOLIO_IMAGE_TYPES.has(file.type)) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return null;
}

export async function fetchPortfolioItems(): Promise<PortfolioItem[]> {
  const response = await fetchWithAuth('/api/contractor/portfolio');
  if (!response.ok) {
    await parseError(response, 'Failed to load portfolio');
  }
  return response.json() as Promise<PortfolioItem[]>;
}

export async function fetchPublicPortfolio(
  contractorId: string,
): Promise<PortfolioItem[]> {
  const response = await fetch(
    `/api/public/contractors/${encodeURIComponent(contractorId)}/portfolio`,
    { cache: 'no-store' },
  );
  if (!response.ok) {
    if (response.status === 404) return [];
    await parseError(response, 'Failed to load portfolio');
  }
  return response.json() as Promise<PortfolioItem[]>;
}

export async function presignPortfolioItem(input: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  title?: string;
}) {
  const response = await fetchWithAuth('/api/contractor/portfolio/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to prepare upload');
  }
  return response.json() as Promise<{
    itemId: string;
    uploadUrl: string;
  }>;
}

export async function completePortfolioItem(itemId: string) {
  const response = await fetchWithAuth(
    `/api/contractor/portfolio/${encodeURIComponent(itemId)}/complete`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to confirm upload');
  }
  return response.json() as Promise<PortfolioItem>;
}

export async function updatePortfolioItem(
  itemId: string,
  input: { title?: string },
) {
  const response = await fetchWithAuth(
    `/api/contractor/portfolio/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to update portfolio item');
  }
  return response.json() as Promise<PortfolioItem>;
}

export async function deletePortfolioItem(itemId: string) {
  const response = await fetchWithAuth(
    `/api/contractor/portfolio/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok && response.status !== 204) {
    await parseError(response, 'Failed to delete portfolio item');
  }
}

export async function uploadPortfolioPhoto(file: File): Promise<PortfolioItem> {
  const contentType = guessPortfolioContentType(file);
  if (!contentType) {
    throw new Error('Use JPEG, PNG, or WebP images.');
  }
  if (file.size > MAX_PORTFOLIO_UPLOAD_BYTES) {
    throw new Error(
      `File exceeds ${MAX_PORTFOLIO_UPLOAD_BYTES / (1024 * 1024)} MB limit.`,
    );
  }

  const { itemId, uploadUrl } = await presignPortfolioItem({
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
  });

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error('Upload to storage failed');
  }

  return completePortfolioItem(itemId);
}
