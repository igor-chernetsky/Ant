import { fetchWithAuth } from '@/lib/auth-client';
import type { ServiceLocation } from '@/lib/locations';

export type SupplyDirectoryKind = 'contractor' | 'designer' | 'supplier';

export interface SupplyDirectoryEntry {
  id: string;
  kind: SupplyDirectoryKind;
  companyName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  serviceLocations: ServiceLocation[];
  tagSlugs: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertDirectoryEntryInput {
  kind: SupplyDirectoryKind;
  companyName: string;
  contactName?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  serviceLocations?: ServiceLocation[] | null;
  tagSlugs?: string[] | null;
  notes?: string | null;
}

export interface DirectoryListOptions {
  excludeRegistered?: boolean;
  locationRegionSlug?: string | null;
  locationAreaSlug?: string | null;
  tagSlugs?: string[];
}

export interface TenderInviteResult {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  kind: SupplyDirectoryKind;
  emailSent: boolean;
  inviteUrl: string;
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

export async function fetchDirectoryEntries(
  kind?: SupplyDirectoryKind,
  options?: DirectoryListOptions,
): Promise<SupplyDirectoryEntry[]> {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (options?.excludeRegistered) params.set('excludeRegistered', '1');
  if (options?.locationRegionSlug?.trim()) {
    params.set('locationRegionSlug', options.locationRegionSlug.trim());
  }
  if (options?.locationAreaSlug?.trim()) {
    params.set('locationAreaSlug', options.locationAreaSlug.trim());
  }
  for (const slug of options?.tagSlugs ?? []) {
    const trimmed = slug.trim();
    if (trimmed) params.append('tagSlugs', trimmed);
  }
  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(`/api/directory${qs}`);
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load directory'));
  }
  return response.json() as Promise<SupplyDirectoryEntry[]>;
}

export async function fetchAdminDirectoryEntries(
  kind?: SupplyDirectoryKind,
): Promise<SupplyDirectoryEntry[]> {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const response = await fetchWithAuth(`/api/admin/directory${qs}`);
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load directory'));
  }
  return response.json() as Promise<SupplyDirectoryEntry[]>;
}

export async function createAdminDirectoryEntry(
  input: UpsertDirectoryEntryInput,
): Promise<SupplyDirectoryEntry> {
  const response = await fetchWithAuth('/api/admin/directory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to create entry'));
  }
  return response.json() as Promise<SupplyDirectoryEntry>;
}

export async function updateAdminDirectoryEntry(
  id: string,
  input: UpsertDirectoryEntryInput,
): Promise<SupplyDirectoryEntry> {
  const response = await fetchWithAuth(
    `/api/admin/directory/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to update entry'));
  }
  return response.json() as Promise<SupplyDirectoryEntry>;
}

export async function deleteAdminDirectoryEntry(id: string): Promise<void> {
  const response = await fetchWithAuth(
    `/api/admin/directory/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(await readError(response, 'Failed to delete entry'));
  }
}

export async function inviteDirectoryEntriesToTender(
  projectId: string,
  entryIds: string[],
): Promise<TenderInviteResult[]> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/invites`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryIds }),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to send invites'));
  }
  return response.json() as Promise<TenderInviteResult[]>;
}

export async function inviteManualRecipientToTender(
  projectId: string,
  input: { email: string; name?: string; kind: SupplyDirectoryKind },
): Promise<TenderInviteResult> {
  const response = await fetchWithAuth(
    `/api/projects/${encodeURIComponent(projectId)}/tender/invites/manual`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to send invite'));
  }
  return response.json() as Promise<TenderInviteResult>;
}

export function suggestedDirectoryKind(
  projectType: string | null | undefined,
): SupplyDirectoryKind {
  return projectType === 'design' ? 'designer' : 'contractor';
}
