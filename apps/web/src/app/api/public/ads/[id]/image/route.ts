import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Stable URL for an uploaded slide image. Resolves a fresh presigned storage
 * link on every request, so `/admin/ads` previews and the home-page card can
 * use one permanent same-origin URL.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const response = await fetch(
    `${getBackendApiUrl()}/v1/public/ads/${encodeURIComponent(id)}/image/download-url`,
    {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { message: 'Slide image not found' },
      { status: response.status },
    );
  }

  const body = (await response.json()) as { downloadUrl?: string };
  if (!body.downloadUrl) {
    return NextResponse.json(
      { message: 'Slide image not found' },
      { status: 502 },
    );
  }

  return NextResponse.redirect(body.downloadUrl);
}
