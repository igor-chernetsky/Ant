export function getAppConfig() {
  const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL;
  const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM;
  const keycloakClientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!keycloakUrl || !keycloakRealm || !keycloakClientId || !apiUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_* env vars. Copy apps/web/.env.example to .env.local',
    );
  }

  return {
    keycloakUrl,
    keycloakRealm,
    keycloakClientId,
    apiUrl,
  };
}
