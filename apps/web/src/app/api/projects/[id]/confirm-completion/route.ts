import { proxyBackendJson } from '@/lib/backend-proxy';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/confirm-completion`,
    { method: 'POST' },
  );
}
