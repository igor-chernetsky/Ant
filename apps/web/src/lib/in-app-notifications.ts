import { fetchWithAuth } from '@/lib/auth-client';

export type InAppNotificationKind =
  | 'client_bid_submitted'
  | 'client_bid_enrolled'
  | 'client_tender_deadline_reached'
  | 'client_contractor_declined_proposal'
  | 'contractor_counter_offer'
  | 'contractor_bid_selected'
  | 'contract_terms_updated'
  | 'contract_party_signed'
  | 'contract_fully_signed';

export interface InAppNotification {
  id: string;
  kind: InAppNotificationKind;
  href: string | null;
  projectId: string | null;
  payload: Record<string, string | number | null> | null;
  readAt: string | null;
  createdAt: string;
}

export interface InAppNotificationsList {
  notifications: InAppNotification[];
  unreadCount: number;
}

async function parseError(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (typeof data.message === 'string') message = data.message;
    else if (Array.isArray(data.message)) message = data.message.join(', ');
  } catch {
    // keep fallback
  }
  throw new Error(message);
}

export async function fetchInAppNotifications(): Promise<InAppNotificationsList> {
  const response = await fetchWithAuth('/api/me/notifications');
  if (!response.ok) {
    await parseError(response, 'Failed to load notifications');
  }
  return response.json() as Promise<InAppNotificationsList>;
}

export async function markInAppNotificationsRead(
  ids?: string[],
): Promise<InAppNotificationsList> {
  const response = await fetchWithAuth('/api/me/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids?.length ? { ids } : {}),
  });
  if (!response.ok) {
    await parseError(response, 'Failed to mark notifications as read');
  }
  return response.json() as Promise<InAppNotificationsList>;
}
