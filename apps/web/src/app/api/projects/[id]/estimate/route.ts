import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/estimate`,
    { method: 'GET' },
  );
}
