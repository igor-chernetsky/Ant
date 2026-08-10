import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/estimate/adjustments`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
