import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; questionId: string; attachmentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, questionId, attachmentId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/tender/clarification-questions/${encodeURIComponent(questionId)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
  );
}
