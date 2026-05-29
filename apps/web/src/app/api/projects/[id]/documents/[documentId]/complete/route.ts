import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const { id, documentId } = await params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/complete`,
    { method: 'POST' },
  );
}
