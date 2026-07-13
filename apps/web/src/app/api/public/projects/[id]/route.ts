import { proxyOptionalBackendJson } from '@/lib/backend-proxy';
import {
  LOCALE_REQUEST_HEADER,
  readLocaleFromCookieHeader,
} from '@/lib/locale-request';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  return proxyOptionalBackendJson(
    `/v1/public/projects/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      headers: {
        [LOCALE_REQUEST_HEADER]: readLocaleFromCookieHeader(
          request.headers.get('cookie'),
        ),
      },
    },
  );
}
