import { proxyBackendJson } from '@/lib/backend-proxy';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyBackendJson(`/v1/admin/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
