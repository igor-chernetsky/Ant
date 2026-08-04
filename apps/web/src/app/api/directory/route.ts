import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const excludeRegistered = url.searchParams.get('excludeRegistered');
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (excludeRegistered) params.set('excludeRegistered', excludeRegistered);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return proxyBackendJson(`/v1/directory${qs}`);
}
