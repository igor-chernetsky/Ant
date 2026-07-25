import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return proxyBackendJson(`/v1/directory${qs}`);
}
