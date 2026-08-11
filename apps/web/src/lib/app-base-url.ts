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

export function resolveAppBaseUrl(options?: {
  nextPublicAppUrl?: string;
  webAppUrl?: string;
  vercelUrl?: string;
}): string {
  const nextPublic =
    options?.nextPublicAppUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  const webApp = options?.webAppUrl ?? process.env.WEB_APP_URL;
  const vercel = options?.vercelUrl ?? process.env.VERCEL_URL;

  for (const raw of [nextPublic, webApp]) {
    const trimmed = raw?.trim();
    if (trimmed) {
      return normalizeAppOrigin(trimmed);
    }
  }

  const vercelTrimmed = vercel?.trim();
  if (vercelTrimmed) {
    return normalizeAppOrigin(
      vercelTrimmed.startsWith('http')
        ? vercelTrimmed
        : `https://${vercelTrimmed}`,
    );
  }

  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return CANONICAL_APP_ORIGIN;
  }

  return 'http://localhost:3000';
}
