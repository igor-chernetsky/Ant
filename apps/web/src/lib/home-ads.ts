import { fetchWithAuth } from './auth-client';

export type LocaleCopy = {
  en: string;
  ru: string;
  th: string;
};

export interface HomeAdSlide {
  id: string;
  sortOrder: number;
  enabled: boolean;
  href: string;
  imageUrl: string;
  title: LocaleCopy;
  description: LocaleCopy;
  ctaLabel: LocaleCopy;
}

export type PublicHomeAdSlide = Omit<HomeAdSlide, 'sortOrder' | 'enabled'>;

export interface HomeAdSlideInput {
  sortOrder?: number;
  enabled?: boolean;
  href: string;
  imageUrl: string;
  title: LocaleCopy;
  description: LocaleCopy;
  ctaLabel: LocaleCopy;
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

export async function fetchPublicHomeAds(): Promise<PublicHomeAdSlide[]> {
  const response = await fetch('/api/public/ads', { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as PublicHomeAdSlide[];
  return Array.isArray(data) ? data : [];
}

export async function fetchAdminHomeAds(): Promise<HomeAdSlide[]> {
  const response = await fetchWithAuth('/api/admin/ads');
  if (!response.ok) {
    await parseError(response, 'Failed to load ads');
  }
  return response.json() as Promise<HomeAdSlide[]>;
}

export async function createAdminHomeAd(
  input: HomeAdSlideInput,
): Promise<HomeAdSlide> {
  const response = await fetchWithAuth('/api/admin/ads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to create slide');
  }
  return response.json() as Promise<HomeAdSlide>;
}

export async function updateAdminHomeAd(
  id: string,
  input: Partial<HomeAdSlideInput>,
): Promise<HomeAdSlide> {
  const response = await fetchWithAuth(
    `/api/admin/ads/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to update slide');
  }
  return response.json() as Promise<HomeAdSlide>;
}

export async function deleteAdminHomeAd(id: string): Promise<void> {
  const response = await fetchWithAuth(
    `/api/admin/ads/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to delete slide');
  }
}

export function adInsertIndex(columnCount: number): number {
  if (columnCount <= 1) return 2;
  return columnCount + 1;
}
