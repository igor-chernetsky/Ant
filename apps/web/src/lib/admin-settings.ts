import { fetchWithAuth } from '@/lib/auth-client';

export interface PlatformSettings {
  contractSignedNotifyEmails: string[];
}

export interface SendAdminBroadcastInput {
  to: string;
  subject: string;
  html: string;
  attachments?: SendAdminBroadcastAttachmentInput[];
}

export interface SendAdminBroadcastAttachmentInput {
  filename: string;
  contentType: string;
  contentBase64: string;
}

export interface BroadcastAttachmentDraft {
  id: string;
  file: File;
}

export const BROADCAST_ATTACHMENT_ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,text/plain';

export const BROADCAST_MAX_ATTACHMENTS = 5;
export const BROADCAST_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const BROADCAST_MAX_ATTACHMENTS_TOTAL_BYTES = 12 * 1024 * 1024;

const ALLOWED_BROADCAST_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

export async function encodeBroadcastAttachment(
  file: File,
): Promise<SendAdminBroadcastAttachmentInput> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return {
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    contentBase64: btoa(binary),
  };
}

export function validateBroadcastAttachmentFile(
  file: File,
  currentCount: number,
  currentTotalBytes: number,
  t: (key: string, params?: Record<string, string | number>) => string,
  formatSize: (bytes: number | null) => string,
): string | null {
  if (currentCount >= BROADCAST_MAX_ATTACHMENTS) {
    return t('admin.settingsBroadcastAttachmentsTooMany', {
      maxFiles: BROADCAST_MAX_ATTACHMENTS,
    });
  }
  if (file.size > BROADCAST_MAX_ATTACHMENT_BYTES) {
    return t('admin.settingsBroadcastAttachmentTooLarge', {
      maxSize: formatSize(BROADCAST_MAX_ATTACHMENT_BYTES),
    });
  }
  if (
    currentTotalBytes + file.size >
    BROADCAST_MAX_ATTACHMENTS_TOTAL_BYTES
  ) {
    return t('admin.settingsBroadcastAttachmentsTotalTooLarge', {
      maxSize: formatSize(BROADCAST_MAX_ATTACHMENTS_TOTAL_BYTES),
    });
  }
  const contentType = file.type || 'application/octet-stream';
  if (!ALLOWED_BROADCAST_ATTACHMENT_TYPES.has(contentType)) {
    return t('admin.settingsBroadcastAttachmentTypeInvalid', {
      name: file.name,
    });
  }
  return null;
}

export interface SendAdminBroadcastResult {
  sent: true;
  from: string;
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

export async function sendAdminBroadcast(
  input: SendAdminBroadcastInput,
): Promise<SendAdminBroadcastResult> {
  const response = await fetchWithAuth('/api/admin/settings/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to send message'));
  }
  return response.json() as Promise<SendAdminBroadcastResult>;
}
