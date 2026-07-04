import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ projectId: string; questionId: string; attachmentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { projectId, questionId, attachmentId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/projects/${encodeURIComponent(projectId)}/clarification-questions/${encodeURIComponent(questionId)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
  );
}
