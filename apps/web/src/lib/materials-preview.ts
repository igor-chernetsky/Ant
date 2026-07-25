import {
  MATERIALS_MARKETPLACES,
  type MaterialsMarketplace,
} from '@/lib/materials-marketplaces';

const PREVIEW_FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type PreviewCacheEntry = {
  imageUrl: string;
  expiresAt: number;
};

const previewCache = new Map<string, PreviewCacheEntry>();

function marketplaceById(id: string): MaterialsMarketplace | null {
  return MATERIALS_MARKETPLACES.find((item) => item.id === id) ?? null;
}

function isAllowedMarketplaceHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return MATERIALS_MARKETPLACES.some((item) => {
    try {
      const allowed = new URL(item.url).hostname.toLowerCase();
      return host === allowed || host.endsWith(`.${allowed}`);
    } catch {
      return false;
    }
  });
}

function absoluteUrl(raw: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(raw, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    if (
      resolved.hostname === 'localhost' ||
      resolved.hostname === '127.0.0.1' ||
      resolved.hostname === '::1'
    ) {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function extractMetaImage(html: string, pageUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
    /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon[^"']*["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    const candidate = match?.[1]?.trim();
    if (!candidate) {
      continue;
    }
    const absolute = absoluteUrl(candidate, pageUrl);
    if (absolute) {
      return absolute;
    }
  }

  return null;
}

function faviconFallback(pageUrl: string): string {
  const host = new URL(pageUrl).hostname;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREVIEW_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,th;q=0.8',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('xml')) {
      // Some sites omit content-type; still try a short read.
      if (contentType && !contentType.includes('text/')) {
        return null;
      }
    }
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a card image for a curated marketplace:
 * 1) static override on the marketplace entry
 * 2) og:image / twitter:image / apple-touch-icon from the site
 * 3) Google favicon for the domain
 */
export async function resolveMarketplacePreviewImage(
  marketplaceId: string,
): Promise<{ imageUrl: string; marketplace: MaterialsMarketplace } | null> {
  const marketplace = marketplaceById(marketplaceId);
  if (!marketplace) {
    return null;
  }

  const cached = previewCache.get(marketplace.id);
  if (cached && cached.expiresAt > Date.now()) {
    return { imageUrl: cached.imageUrl, marketplace };
  }

  let imageUrl = marketplace.imageUrl?.trim() || null;

  if (!imageUrl) {
    const html = await fetchText(marketplace.url);
    if (html) {
      imageUrl = extractMetaImage(html, marketplace.url);
    }
  }

  if (!imageUrl) {
    imageUrl = faviconFallback(marketplace.url);
  }

  previewCache.set(marketplace.id, {
    imageUrl,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return { imageUrl, marketplace };
}

export function assertPreviewImageUrlAllowed(imageUrl: string): boolean {
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    ) {
      return false;
    }
    // Allow marketplace hosts, known CDNs, and favicon fallback host.
    if (parsed.hostname === 'www.google.com' && parsed.pathname.startsWith('/s2/favicons')) {
      return true;
    }
    if (isAllowedMarketplaceHost(parsed.hostname)) {
      return true;
    }
    // og:image often lives on CDN hosts (GCS, homepro static, etc.)
    return true;
  } catch {
    return false;
  }
}
