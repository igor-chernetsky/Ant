import { NextResponse, type NextRequest } from 'next/server';
import { CANONICAL_APP_ORIGIN, normalizeAppOrigin } from '@/lib/app-base-url';
import { DEFAULT_LOCALE, LOCALE_COOKIE } from '@/lib/i18n/locales';
import {
  NEGOTIATED_LOCALE_HEADER,
  negotiateLocaleFromAcceptLanguage,
} from '@/lib/locale-negotiation';

/**
 * Two jobs, in order:
 *
 * 1. Keep every page on the canonical host. The app is reachable both on
 *    `www.builthai.com` and on its Vercel deployment host
 *    (`ant-eta-seven.vercel.app`), which serves identical HTML. Without a
 *    redirect Google can index the deployment host as a duplicate — and it used
 *    to be linked from the public offer documents.
 * 2. Pick the interface language for a first visit from `Accept-Language`.
 *    The app has no per-locale URLs: language lives in the `ant_locale` cookie,
 *    so without this step every guest — including Thai and Russian visitors —
 *    started in English until they found the switcher.
 *
 * Exemptions:
 * - Preview deployments (`VERCEL_ENV=preview`) must stay reachable on their own
 *   URL, otherwise they cannot be reviewed before promoting.
 * - Local development hosts.
 * - API routes, static files and the Sentry tunnel (see `config.matcher`).
 */
const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.localhost')
  );
}

/**
 * Host that should serve every page, or `null` when the request must not be
 * redirected (preview deployment or local development without a configured
 * production origin).
 */
function resolveCanonicalHost(): string | null {
  if (process.env.VERCEL_ENV === 'preview') {
    return null;
  }

  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.WEB_APP_URL?.trim();
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const origin = configured
    ? normalizeAppOrigin(configured)
    : isProduction
      ? CANONICAL_APP_ORIGIN
      : null;

  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

function withNegotiatedLocale(request: NextRequest): NextResponse {
  // An explicit choice in the language switcher always wins.
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale) {
    return NextResponse.next();
  }

  const locale = negotiateLocaleFromAcceptLanguage(
    request.headers.get('accept-language'),
  );
  // Nothing to persist when the browser already wants the default: skipping the
  // cookie keeps `Set-Cookie` off every crawler response.
  if (!locale || locale === DEFAULT_LOCALE) {
    return NextResponse.next();
  }

  const headers = new Headers(request.headers);
  headers.set(NEGOTIATED_LOCALE_HEADER, locale);
  const response = NextResponse.next({ request: { headers } });

  response.cookies.set({
    name: LOCALE_COOKIE,
    value: locale,
    path: '/',
    sameSite: 'lax',
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    secure: request.nextUrl.protocol === 'https:',
  });

  return response;
}

export function middleware(request: NextRequest): NextResponse {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  if (host && !isLocalHost(host)) {
    const canonicalHost = resolveCanonicalHost();
    if (canonicalHost && host !== canonicalHost) {
      const url = request.nextUrl.clone();
      url.protocol = 'https:';
      url.host = canonicalHost;
      url.port = '';
      return NextResponse.redirect(url, 301);
    }
  }

  // API responses carry their own locale header from the caller.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  return withNegotiatedLocale(request);
}

export const config = {
  matcher: [
    // Redirect HTML routes only: skip Next.js assets, the Sentry tunnel and
    // static files, so an OG image or favicon on a non-canonical host still
    // resolves without a hop.
    '/((?!_next/static|_next/image|monitoring|og.png|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
