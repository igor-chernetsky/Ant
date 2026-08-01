import { proxyOptionalBackendJson } from '@/lib/backend-proxy';
import {
  LOCALE_REQUEST_HEADER,
  readLocaleFromCookieHeader,
} from '@/lib/locale-request';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tagParams = url.searchParams.getAll('tag');
  const statusParams = url.searchParams.getAll('status');
  const region = url.searchParams.get('region');
  const area = url.searchParams.get('area');
  const track = url.searchParams.get('track');
  const propertyTypeParams = url.searchParams.getAll('propertyType');
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');
  const qs = [
    ...tagParams.map((tag) => `tag=${encodeURIComponent(tag)}`),
    ...statusParams.map((status) => `status=${encodeURIComponent(status)}`),
    ...(track ? [`track=${encodeURIComponent(track)}`] : []),
    ...propertyTypeParams.map(
      (propertyType) => `propertyType=${encodeURIComponent(propertyType)}`,
    ),
    ...(region ? [`region=${encodeURIComponent(region)}`] : []),
    ...(area ? [`area=${encodeURIComponent(area)}`] : []),
    ...(limit ? [`limit=${encodeURIComponent(limit)}`] : []),
    ...(offset ? [`offset=${encodeURIComponent(offset)}`] : []),
  ].join('&');

  const localeFromClient = request.headers.get(LOCALE_REQUEST_HEADER);

  return proxyOptionalBackendJson(
    `/v1/public/projects${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      headers: {
        [LOCALE_REQUEST_HEADER]:
          localeFromClient ??
          readLocaleFromCookieHeader(request.headers.get('cookie')),
      },
    },
  );
}
