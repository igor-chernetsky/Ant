const ACCESS_TOKEN_COOKIE = 'platform_access_token';

export function getKeycloakTokenUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL;
  const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM;

  if (!baseUrl || !realm) {
    throw new Error(
      'Missing NEXT_PUBLIC_KEYCLOAK_URL or NEXT_PUBLIC_KEYCLOAK_REALM',
    );
  }

  return `${baseUrl}/realms/${realm}/protocol/openid-connect/token`;
}

/** Confidential BFF client — server env only, never NEXT_PUBLIC */
export function getKeycloakBffCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.KEYCLOAK_BFF_CLIENT_ID ?? 'platform-bff';
  const clientSecret = process.env.KEYCLOAK_BFF_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error(
      'Missing KEYCLOAK_BFF_CLIENT_SECRET (set in Vercel / .env.local)',
    );
  }

  return { clientId, clientSecret };
}

export function getBackendApiUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error('Missing NEXT_PUBLIC_API_URL');
  }
  return apiUrl;
}

export { ACCESS_TOKEN_COOKIE };
