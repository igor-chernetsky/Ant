import Keycloak from 'keycloak-js';
import { getAppConfig } from './config';

let instance: Keycloak | null = null;

export function getKeycloak(): Keycloak {
  if (!instance) {
    const config = getAppConfig();
    instance = new Keycloak({
      url: config.keycloakUrl,
      realm: config.keycloakRealm,
      clientId: config.keycloakClientId,
    });
  }
  return instance;
}

export async function ensureFreshToken(keycloak: Keycloak): Promise<string | undefined> {
  if (!keycloak.authenticated) {
    return undefined;
  }
  try {
    await keycloak.updateToken(30);
    return keycloak.token;
  } catch {
    await keycloak.login();
    return keycloak.token;
  }
}
