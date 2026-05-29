const ACCESS_TOKEN_COOKIE = 'platform_access_token';

export function getKeycloakTokenUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL;
  const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM;
  const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID;

  if (!baseUrl || !realm || !clientId) {
    throw new Error('Missing Keycloak NEXT_PUBLIC_* environment variables');
  }

  return `${baseUrl}/realms/${realm}/protocol/openid-connect/token`;
}

export function getKeycloakClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing NEXT_PUBLIC_KEYCLOAK_CLIENT_ID');
  }
  return clientId;
}

export function getBackendApiUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error('Missing NEXT_PUBLIC_API_URL');
  }
  return apiUrl;
}

export { ACCESS_TOKEN_COOKIE };
