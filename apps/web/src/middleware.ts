import { NextResponse, type NextRequest } from 'next/server';
import { CANONICAL_APP_ORIGIN, normalizeAppOrigin } from '@/lib/app-base-url';

/**
 * Keep every page on the canonical host.
 *
 * The app is reachable both on `www.builthai.com` and on its Vercel
 * deployment host (`ant-eta-seven.vercel.app`), which serves identical HTML.
 * Without a redirect Google can index the deployment host as a duplicate — and
 * it used to be linked from the public offer documents.
 *
 * Exemptions:
 * - Preview deployments (`VERCEL_ENV=preview`) must stay reachable on their own
 *   URL, otherwise they cannot be reviewed before promoting.
 * - Local development hosts.
 * - Static files and the Sentry tunnel (see `config.matcher`).
 */
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

export function middleware(request: NextRequest): NextResponse {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  if (!host || isLocalHost(host)) {
    return NextResponse.next();
  }

  const canonicalHost = resolveCanonicalHost();
  if (!canonicalHost || host === canonicalHost) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.protocol = 'https:';
  url.host = canonicalHost;
  url.port = '';

  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: [
    // Redirect HTML routes only: skip Next.js assets, the Sentry tunnel and
    // static files, so an OG image or favicon on a non-canonical host still
    // resolves without a hop.
    '/((?!_next/static|_next/image|monitoring|og.png|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
