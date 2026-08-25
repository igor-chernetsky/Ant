import { fetchWithAuth } from './auth-client';

export interface AdminClientListItem {
  id: string;
  email: string | null;
  displayName: string | null;
  preferredLocale: string;
  createdAt: string;
  projectCount: number;
  activeProjectCount: number;
  lastProjectAt: string | null;
}

export interface AdminClientListPage {
  items: AdminClientListItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdminClientProjectSummary {
  id: string;
  title: string;
  status: string;
  projectType: string;
  isHidden: boolean;
  locationRegionSlug: string;
  createdAt: string;
  updatedAt: string;
  contractAmount: number | null;
  contractFullySignedAt: string | null;
  platformFeePaid: boolean;
}

export interface AdminClientLegalSnapshot {
  employerName: string | null;
  employerAddress: string | null;
  employerRegistrationNo: string | null;
  sourceProjectId: string | null;
  sourceProjectTitle: string | null;
}

export interface AdminClientDetail extends AdminClientListItem {
  updatedAt: string;
  legal: AdminClientLegalSnapshot | null;
  projects: AdminClientProjectSummary[];
  invoices: [];
  vatCertificates: [];
  paymentInfo: null;
  paymentSlipCount: number;
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

export async function fetchAdminClients(params: {
  q?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminClientListPage> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await fetchWithAuth(`/api/admin/clients${suffix}`);
  if (!response.ok) {
    await parseError(response, 'Failed to load clients');
  }
  return response.json() as Promise<AdminClientListPage>;
}

export async function fetchAdminClient(
  clientId: string,
): Promise<AdminClientDetail> {
  const response = await fetchWithAuth(
    `/api/admin/clients/${encodeURIComponent(clientId)}`,
  );
  if (!response.ok) {
    await parseError(response, 'Failed to load client');
  }
  return response.json() as Promise<AdminClientDetail>;
}
