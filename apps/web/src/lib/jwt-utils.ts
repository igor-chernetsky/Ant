/** Decode JWT payload (no signature verification — expiry hint only). */
export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof Buffer !== 'undefined'
        ? Buffer.from(padded, 'base64').toString('utf8')
        : atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True when token is missing, malformed, or expires within skewSeconds. */
export function accessTokenNeedsRefresh(
  token: string | null | undefined,
  skewSeconds = 60,
): boolean {
  if (!token) {
    return true;
  }

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }

  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
