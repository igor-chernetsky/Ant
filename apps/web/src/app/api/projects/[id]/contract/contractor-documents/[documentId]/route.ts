import { NextResponse } from 'next/server';
import { proxyBackend } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; documentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, documentId } = await context.params;
  const { response } = await proxyBackend(
    `/v1/projects/${encodeURIComponent(id)}/contract/contractor-documents/${encodeURIComponent(documentId)}`,
  );

  if (response instanceof NextResponse) {
    return response;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return NextResponse.json(
      { message: text || 'Failed to load contractor document' },
      { status: response.status },
    );
  }

  const body = (await response.json()) as { downloadUrl?: string };
  if (!body.downloadUrl) {
    return NextResponse.json(
      { message: 'Failed to load contractor document' },
      { status: 502 },
    );
  }

  return NextResponse.redirect(body.downloadUrl);
}
