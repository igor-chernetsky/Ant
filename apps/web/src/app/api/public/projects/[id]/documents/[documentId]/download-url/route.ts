import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';

type RouteContext = {
  params: Promise<{ id: string; documentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, documentId } = await context.params;

  try {
    const backendResponse = await fetch(
      `${getBackendApiUrl()}/v1/public/projects/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/download-url`,
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
