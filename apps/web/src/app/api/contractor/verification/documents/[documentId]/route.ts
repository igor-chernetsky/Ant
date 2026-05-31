import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ documentId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { documentId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/verification/documents/${encodeURIComponent(documentId)}/complete`,
    { method: 'POST' },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const { documentId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/verification/documents/${encodeURIComponent(documentId)}/download-url`,
  );
}
