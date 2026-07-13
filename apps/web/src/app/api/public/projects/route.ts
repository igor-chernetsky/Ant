import { proxyOptionalBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tagParams = url.searchParams.getAll('tag');
  const statusParams = url.searchParams.getAll('status');
  const region = url.searchParams.get('region');
  const area = url.searchParams.get('area');
  const serviceParams = url.searchParams.getAll('service');
  const ownershipParams = url.searchParams.getAll('ownership');
  const qs = [
    ...tagParams.map((tag) => `tag=${encodeURIComponent(tag)}`),
    ...statusParams.map((status) => `status=${encodeURIComponent(status)}`),
    ...serviceParams.map((service) => `service=${encodeURIComponent(service)}`),
    ...ownershipParams.map(
      (ownership) => `ownership=${encodeURIComponent(ownership)}`,
    ),
    ...(region ? [`region=${encodeURIComponent(region)}`] : []),
    ...(area ? [`area=${encodeURIComponent(area)}`] : []),
  ].join('&');

  return proxyOptionalBackendJson(
    `/v1/public/projects${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}
