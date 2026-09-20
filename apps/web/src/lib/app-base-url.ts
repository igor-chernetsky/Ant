/** Canonical production origin — not "buildthai.com". */
export const CANONICAL_APP_ORIGIN = 'https://www.builthai.com';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Corrects a common typo: buildthai.com → builthai.com (extra "d").
 * Logs once per process when a misconfiguration is auto-corrected.
 */
export function normalizeAppOrigin(url: string): string {
  const trimmed = trimTrailingSlash(url.trim());
  if (!trimmed) return trimmed;

  if (/buildthai\.com/i.test(trimmed)) {
    const fixed = trimmed.replace(/buildthai\.com/gi, 'builthai.com');
    console.warn(
      `[app-base-url] Misconfigured domain "buildthai.com" — using "${fixed}". Set NEXT_PUBLIC_APP_URL to ${CANONICAL_APP_ORIGIN}.`,
    );
    return fixed;
  }

  return trimmed;
}

function resolveFirstConfigured(
  candidates: Array<string | undefined>,
): string | null {
  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (trimmed) {
      return normalizeAppOrigin(trimmed);
    }
  }
  return null;
}

let warnedMissingOrigin = false;

function warnMissingOriginOnce(): void {
  if (warnedMissingOrigin) return;
  warnedMissingOrigin = true;
  console.warn(
    `[app-base-url] Neither NEXT_PUBLIC_APP_URL nor WEB_APP_URL is set — using ${CANONICAL_APP_ORIGIN} for canonical URLs, sitemap.xml and JSON-LD. Set NEXT_PUBLIC_APP_URL in Vercel to keep them on the production host.`,
  );
}

/**
 * Origin for canonical URLs, `metadataBase`, sitemap.xml and JSON-LD.
 *
 * Deliberately ignores `VERCEL_URL`: on a preview deployment that is a
 * `*.vercel.app` host, and letting it leak into canonicals points Google at a
 * throwaway domain and de-indexes production. Use
 * {@link resolveLinkBaseUrl} when you need preview-aware links.
 */
export function resolveAppBaseUrl(options?: {
  nextPublicAppUrl?: string;
  webAppUrl?: string;
}): string {
  const configured = resolveFirstConfigured([
    options?.nextPublicAppUrl ?? process.env.NEXT_PUBLIC_APP_URL,
    options?.webAppUrl ?? process.env.WEB_APP_URL,
  ]);
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    warnMissingOriginOnce();
    return CANONICAL_APP_ORIGIN;
  }

  return 'http://localhost:3000';
}

/**
 * Origin for links we send out (verification and password-reset e-mails).
 * Unlike {@link resolveAppBaseUrl} this keeps `VERCEL_URL` so preview
 * deployments can be tested end-to-end.
 */
export function resolveLinkBaseUrl(options?: {
  nextPublicAppUrl?: string;
  webAppUrl?: string;
  vercelUrl?: string;
}): string {
  const configured = resolveFirstConfigured([
    options?.nextPublicAppUrl ?? process.env.NEXT_PUBLIC_APP_URL,
    options?.webAppUrl ?? process.env.WEB_APP_URL,
  ]);
  if (configured) {
    return configured;
  }

  const vercel = (options?.vercelUrl ?? process.env.VERCEL_URL)?.trim();
  if (vercel) {
    return normalizeAppOrigin(
      vercel.startsWith('http') ? vercel : `https://${vercel}`,
    );
  }

  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return CANONICAL_APP_ORIGIN;
  }

  return 'http://localhost:3000';
}
