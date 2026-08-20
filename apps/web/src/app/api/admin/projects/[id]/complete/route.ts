import { proxyBackendJson } from '@/lib/backend-proxy';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyBackendJson(
    `/v1/admin/projects/${encodeURIComponent(id)}/complete`,
    { method: 'POST' },
  );
}
