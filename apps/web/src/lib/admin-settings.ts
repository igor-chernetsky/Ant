import { fetchWithAuth } from '@/lib/auth-client';

export interface PlatformSettings {
  contractSignedNotifyEmails: string[];
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (Array.isArray(body?.message)) {
    return body.message.join(', ');
  }
  return typeof body?.message === 'string' ? body.message : fallback;
}

export async function fetchAdminPlatformSettings(): Promise<PlatformSettings> {
  const response = await fetchWithAuth('/api/admin/settings');
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load settings'));
  }
  return response.json() as Promise<PlatformSettings>;
}

export async function updateAdminPlatformSettings(
  input: PlatformSettings,
): Promise<PlatformSettings> {
  const response = await fetchWithAuth('/api/admin/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to save settings'));
  }
  return response.json() as Promise<PlatformSettings>;
}
