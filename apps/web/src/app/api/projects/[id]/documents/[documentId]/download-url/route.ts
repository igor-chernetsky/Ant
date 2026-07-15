import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id, documentId } = await params;
  const variant = new URL(request.url).searchParams.get('variant');
  const query =
    variant === 'thumb' ? '?variant=thumb' : '';
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/download-url${query}`,
  );
}
