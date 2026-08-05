import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{
    projectId: string;
    addendumId: string;
    attachmentId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { projectId, addendumId, attachmentId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(projectId)}/contract/addenda/${encodeURIComponent(addendumId)}/attachments/${encodeURIComponent(attachmentId)}/complete`,
    { method: 'POST' },
  );
}
