import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await context.params;
  return proxyBackendJson(`/v1/admin/clients/${encodeURIComponent(clientId)}`);
}
