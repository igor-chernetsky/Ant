import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ contractorId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { contractorId } = await context.params;
  return proxyBackendJson(
    `/v1/admin/contractors/${encodeURIComponent(contractorId)}/approve`,
    { method: 'POST' },
  );
}
