/** Canonical production origin — not "buildthai.com". */
export const CANONICAL_APP_ORIGIN = 'https://www.builthai.com';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Corrects buildthai.com → builthai.com (common env typo). */
export function normalizeAppOrigin(url: string): string {
  const trimmed = trimTrailingSlash(url.trim());
  if (!trimmed) return trimmed;

  if (/buildthai\.com/i.test(trimmed)) {
    const fixed = trimmed.replace(/buildthai\.com/gi, 'builthai.com');
    console.warn(
      `[app-base-url] Misconfigured domain "buildthai.com" — using "${fixed}". Set WEB_APP_URL to ${CANONICAL_APP_ORIGIN}.`,
    );
    return fixed;
  }

  return trimmed;
}

export function resolveAppBaseUrl(getEnv: (key: string) => string | undefined): string {
  for (const key of ['WEB_APP_URL', 'NEXT_PUBLIC_APP_URL'] as const) {
    const raw = getEnv(key)?.trim();
    if (raw) {
      return normalizeAppOrigin(raw);
    }
  }
  if (getEnv('NODE_ENV') === 'production') {
    return CANONICAL_APP_ORIGIN;
  }
  return 'http://localhost:3000';
}
