import { getAppConfig } from './config';

export interface MeResponse {
  id: string;
  keycloakSub: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
}

export async function fetchMe(accessToken: string): Promise<MeResponse> {
  const response = await fetch(`${getAppConfig().apiUrl}/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json() as Promise<MeResponse>;
}
