import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id, attachmentId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/review-attachments/${encodeURIComponent(attachmentId)}/complete`,
    { method: 'POST' },
  );
}
