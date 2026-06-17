import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ tenderId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { tenderId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/tenders/${encodeURIComponent(tenderId)}/enroll`,
    { method: 'POST' },
  );
}
