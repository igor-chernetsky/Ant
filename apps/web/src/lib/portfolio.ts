import { fetchWithAuth } from './auth-client';
import { ensureSessionFresh } from './session';

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
  const normalizedType = file.type?.split(';')[0]?.trim().toLowerCase();
  if (normalizedType?.startsWith('image/')) {
    if (PORTFOLIO_IMAGE_TYPES.has(normalizedType)) {
      return normalizedType;
    }
    // Browsers may report image/jpg or other aliases — normalize common cases.
    if (normalizedType === 'image/jpg' || normalizedType === 'image/pjpeg') {
      return 'image/jpeg';
    }
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
  const sessionOk = await ensureSessionFresh();
  if (!sessionOk) {
    throw new Error('Session expired. Please sign in again.');
  }

  const contentType = guessPortfolioContentType(file);
  if (!contentType) {
    throw new Error('Use JPEG, PNG, or WebP images.');
  }
  if (file.size > MAX_PORTFOLIO_UPLOAD_BYTES) {
    throw new Error(
      `File exceeds ${MAX_PORTFOLIO_UPLOAD_BYTES / (1024 * 1024)} MB limit.`,
    );
  }

  const patched =
    file.type === contentType
      ? file
      : new File([file], file.name, { type: contentType });

  const { itemId, uploadUrl } = await presignPortfolioItem({
    fileName: patched.name,
    contentType,
    sizeBytes: patched.size,
  });

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: patched,
  });
  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text().catch(() => '');
    throw new Error(
      `Upload to storage failed (${uploadResponse.status}). Check S3 CORS and bucket settings. ${detail.slice(0, 120)}`,
    );
  }

  return completePortfolioItem(itemId);
}

export async function syncPendingPortfolioItems(
  items: PortfolioItem[],
): Promise<PortfolioItem[]> {
  const pending = items.filter((item) => item.status === 'pending');
  if (pending.length === 0) {
    return items;
  }

  const synced = [...items];
  for (const item of pending) {
    try {
      const completed = await completePortfolioItem(item.id);
      const index = synced.findIndex((entry) => entry.id === item.id);
      if (index >= 0) {
        synced[index] = completed;
      } else {
        synced.push(completed);
      }
    } catch {
      // Leave pending item as-is; UI can retry on next load.
    }
  }
  return synced;
}
