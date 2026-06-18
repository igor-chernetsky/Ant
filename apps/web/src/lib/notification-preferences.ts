import { fetchWithAuth } from '@/lib/auth-client';

export interface NotificationPreferences {
  emailEnabled: boolean;
  emailClientBidActivity: boolean;
  emailContractorUpdates: boolean;
  emailMatchingProjects: boolean;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await fetchWithAuth('/api/me/notification-preferences');
  if (!response.ok) {
    throw new Error('Failed to load notification preferences');
  }
  return response.json() as Promise<NotificationPreferences>;
}

export async function updateNotificationPreferences(
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const response = await fetchWithAuth('/api/me/notification-preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error('Failed to save notification preferences');
  }
  return response.json() as Promise<NotificationPreferences>;
}
