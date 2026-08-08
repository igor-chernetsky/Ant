import { NextRequest } from 'next/server';
import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ projectId: string; addendumId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { projectId, addendumId } = await context.params;
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const withAttachments = url.searchParams.get('withAttachments');
  if (withAttachments) {
    params.set('withAttachments', withAttachments);
  }
  const formats = url.searchParams.get('formats');
  if (formats) {
    params.set('formats', formats);
  }
  const includeSignatures = url.searchParams.get('includeSignatures');
  if (includeSignatures) {
    params.set('includeSignatures', includeSignatures);
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(projectId)}/contract/addenda/${encodeURIComponent(addendumId)}/download${query}`,
  );
}
