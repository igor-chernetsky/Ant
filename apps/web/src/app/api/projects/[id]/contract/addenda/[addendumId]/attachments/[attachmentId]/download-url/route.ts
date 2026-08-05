import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; addendumId: string; attachmentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, addendumId, attachmentId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/contract/addenda/${encodeURIComponent(addendumId)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
  );
}
