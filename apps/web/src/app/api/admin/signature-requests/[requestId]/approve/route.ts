import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { requestId } = await context.params;
  return proxyBackendJson(
    `/v1/admin/signature-requests/${encodeURIComponent(requestId)}/approve`,
    { method: 'POST' },
  );
}
