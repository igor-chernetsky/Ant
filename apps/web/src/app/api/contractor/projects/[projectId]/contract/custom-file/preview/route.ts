import { NextResponse } from 'next/server';
import { proxyBackend } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ projectId: string }> };

function inlineFileName(name: string): string {
  const safe = name.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 180) || 'contract';
  return `inline; filename="${safe}"`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const { response } = await proxyBackend(
    `/v1/contractor/projects/${encodeURIComponent(projectId)}/contract/custom-file`,
  );

  if (response instanceof NextResponse) {
    return response;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return NextResponse.json(
      { message: text || 'Failed to load custom contract' },
      { status: response.status },
    );
  }

  const body = (await response.json()) as {
    downloadUrl?: string;
    originalName?: string;
    contentType?: string;
  };
  if (!body.downloadUrl) {
    return NextResponse.json(
      { message: 'Failed to load custom contract' },
      { status: 502 },
    );
  }

  const fileResponse = await fetch(body.downloadUrl, { cache: 'no-store' });
  if (!fileResponse.ok || !fileResponse.body) {
    return NextResponse.json(
      { message: 'Failed to fetch custom contract file' },
      { status: 502 },
    );
  }

  const contentType =
    body.contentType ||
    fileResponse.headers.get('content-type') ||
    'application/octet-stream';
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set(
    'Content-Disposition',
    inlineFileName(body.originalName || 'contract'),
  );
  headers.set('Cache-Control', 'private, max-age=60');
  const length = fileResponse.headers.get('content-length');
  if (length) headers.set('Content-Length', length);

  return new NextResponse(fileResponse.body, {
    status: 200,
    headers,
  });
}
