import { proxyOptionalBackendJson } from '@/lib/backend-proxy';
import {
  LOCALE_REQUEST_HEADER,
  readLocaleFromCookieHeader,
} from '@/lib/locale-request';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const invite = new URL(request.url).searchParams.get('invite');
  const qs = invite ? `?invite=${encodeURIComponent(invite)}` : '';

  return proxyOptionalBackendJson(
    `/v1/public/projects/${encodeURIComponent(id)}${qs}`,
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
