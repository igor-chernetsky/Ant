import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { itemId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/portfolio/${encodeURIComponent(itemId)}/complete`,
    { method: 'POST' },
  );
}
