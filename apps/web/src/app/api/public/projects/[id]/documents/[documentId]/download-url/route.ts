import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';
import {
  proxyBackendJson,
  proxyOptionalBackendJson,
} from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; documentId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id, documentId } = await context.params;
  const url = new URL(request.url);
  const variant = url.searchParams.get('variant');
  const invite = url.searchParams.get('invite');
  const params = new URLSearchParams();
  if (variant === 'thumb') params.set('variant', 'thumb');
  if (invite) params.set('invite', invite);
  const query = params.toString() ? `?${params.toString()}` : '';
  const backendPath = `/v1/public/projects/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/download-url${query}`;

  // Thumbnails remain anonymously fetchable; invite guests use optional proxy for originals.
  if (variant === 'thumb') {
    try {
      const backendResponse = await fetch(
        `${getBackendApiUrl()}${backendPath}`,
        { cache: 'no-store' },
      );
      const text = await backendResponse.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { message: text };
      }
      return NextResponse.json(body, { status: backendResponse.status });
    } catch {
      return NextResponse.json(
        { message: 'Unable to reach API server' },
        { status: 502 },
      );
    }
  }

  if (invite) {
    return proxyOptionalBackendJson(backendPath, { method: 'GET' });
  }

  return proxyBackendJson(backendPath);
}
