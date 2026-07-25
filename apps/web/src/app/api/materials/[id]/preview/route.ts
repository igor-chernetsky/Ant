import {
  assertPreviewImageUrlAllowed,
  resolveMarketplacePreviewImage,
} from '@/lib/materials-preview';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const resolved = await resolveMarketplacePreviewImage(id);
  if (!resolved) {
    return new Response('Not found', { status: 404 });
  }

  if (!assertPreviewImageUrlAllowed(resolved.imageUrl)) {
    return new Response('Preview unavailable', { status: 502 });
  }

  try {
    const upstream = await fetch(resolved.imageUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; AntMaterialsPreview/1.0; +https://ant.local)',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: resolved.marketplace.url,
      },
      // Edge/CDN can cache; source resolution is also memory-cached.
      next: { revalidate: 86_400 },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response('Preview unavailable', { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/') && !contentType.includes('svg')) {
      return new Response('Preview unavailable', { status: 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new Response('Preview unavailable', { status: 502 });
  }
}
