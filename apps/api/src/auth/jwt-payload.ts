export interface JwtPayload {
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  realm_access?: {
    roles?: string[];
  };
}

/**
 * Keycloak must include `sub` in the access token (request scope `openid`).
 */
export function extractKeycloakSub(payload: JwtPayload): string {
  const raw = payload as Record<string, unknown>;
  const candidates = [payload.sub, raw['sub'], raw['subject']];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  const username = payload.preferred_username ?? raw['preferred_username'];
  if (typeof username === 'string' && username.trim().length > 0) {
    return `preferred_username:${username.trim()}`;
  }

  return '';
}
