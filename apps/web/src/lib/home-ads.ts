import { fetchWithAuth } from './auth-client';

export type LocaleCopy = {
  en: string;
  ru: string;
  th: string;
};

/**
 * Slide layout. `card` is the original layout (image plus copy), `image` shows
 * the picture alone.
 */
export type HomeAdTemplate = 'card' | 'image';

/** Where the slide image comes from. */
export type HomeAdImageSource = 'url' | 'upload';

/** Formats the API accepts for an uploaded slide image. */
export const AD_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
export const MAX_AD_IMAGE_BYTES = 8 * 1024 * 1024;

export interface HomeAdSlide {
  id: string;
  sortOrder: number;
  enabled: boolean;
  template: HomeAdTemplate;
  /** Required for `card`; `null` on an `image` slide means "open the lightbox". */
  href: string | null;
  /** External URL; `null` when the image was uploaded. */
  imageUrl: string | null;
  /** `true` when the image is served from object storage. */
  imageUploaded: boolean;
  title: LocaleCopy;
  description: LocaleCopy;
  ctaLabel: LocaleCopy;
}

export type PublicHomeAdSlide = Omit<HomeAdSlide, 'sortOrder' | 'enabled'>;

export interface HomeAdSlideInput {
  sortOrder?: number;
  enabled?: boolean;
  template?: HomeAdTemplate;
  imageSource?: HomeAdImageSource;
  imageUrl?: string | null;
  /** Key from {@link presignAdminHomeAdImage} after the browser uploaded the file. */
  imageStorageKey?: string;
  href?: string | null;
  title: LocaleCopy;
  description: LocaleCopy;
  ctaLabel: LocaleCopy;
}

/**
 * URL to put into `<img src>`.
 *
 * Uploaded images are served through our own route, which redirects to a fresh
 * presigned storage link — a stable, cacheable URL on the site's own domain.
 */
export function homeAdImageSrc(
  slide: Pick<HomeAdSlide, 'id' | 'imageUrl' | 'imageUploaded'>,
): string {
  if (slide.imageUploaded) {
    return `/api/public/ads/${encodeURIComponent(slide.id)}/image`;
  }
  return slide.imageUrl ?? '';
}

export async function presignAdminHomeAdImage(input: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): Promise<{ uploadUrl: string; storageKey: string; expiresInSeconds: number }> {
  const response = await fetchWithAuth('/api/admin/ads/image/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to prepare the upload');
  }
  return response.json() as Promise<{
    uploadUrl: string;
    storageKey: string;
    expiresInSeconds: number;
  }>;
}

/** Presign, PUT the file straight to storage, and return the storage key. */
export async function uploadAdminHomeAdImage(file: File): Promise<string> {
  if (file.size > MAX_AD_IMAGE_BYTES) {
    throw new Error(
      `Image exceeds ${MAX_AD_IMAGE_BYTES / (1024 * 1024)} MB limit`,
    );
  }

  const contentType = file.type || 'application/octet-stream';
  const presigned = await presignAdminHomeAdImage({
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
  });

  const putResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!putResponse.ok) {
    const detail = await putResponse.text().catch(() => '');
    throw new Error(
      `Upload to storage failed (${putResponse.status}). Check S3 CORS and bucket name. ${detail.slice(0, 120)}`,
    );
  }

  return presigned.storageKey;
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
