import { proxyBackendJson } from '@/lib/backend-proxy';

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/projects/${encodeURIComponent(projectId)}/confirm-completion`,
    { method: 'POST' },
  );
}
