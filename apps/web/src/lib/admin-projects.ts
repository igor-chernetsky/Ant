import { fetchWithAuth } from './auth-client';

export type AdminProjectSortBy =
  | 'createdAt'
  | 'title'
  | 'estimate'
  | 'contractAmount'
  | 'signedAt';
export type AdminProjectSortDir = 'asc' | 'desc';

export interface AdminProjectEstimate {
  minAmount: number;
  maxAmount: number;
  midAmount: number;
  currency: string;
  confidence: number;
}

export interface AdminProjectListItem {
  id: string;
  title: string;
  description: string | null;
  projectType: string;
  status: string;
  isHidden: boolean;
  platformFeePaid: boolean;
  readinessScore: number;
  coverImageUrl: string | null;
  estimate: AdminProjectEstimate | null;
  client: {
    id: string;
    displayName: string | null;
    email: string | null;
  };
  locationRegionSlug: string;
  locationAreaSlug: string | null;
  locationNote: string | null;
  district: string | null;
  awardedContractorName: string | null;
  tenderStatus: string | null;
  bidCount: number;
  createdAt: string;
  updatedAt: string;
  contractAmount: number | null;
  contractFullySignedAt: string | null;
  completedAt: string | null;
}

export interface AdminProjectListPage {
  items: AdminProjectListItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdminProjectListParams {
  q?: string;
  status?: string;
  projectType?: string;
  hidden?: 'true' | 'false' | '';
  clientQ?: string;
  createdFrom?: string;
  createdTo?: string;
  locationRegionSlug?: string;
  hasEstimate?: 'true' | 'false' | '';
  contractAmountMin?: string;
  contractAmountMax?: string;
  signedFrom?: string;
  signedTo?: string;
  sortBy?: AdminProjectSortBy;
  sortDir?: AdminProjectSortDir;
  limit?: number;
  offset?: number;
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

export async function fetchAdminProjects(
  params: AdminProjectListParams = {},
): Promise<AdminProjectListPage> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.projectType) qs.set('projectType', params.projectType);
  if (params.hidden === 'true' || params.hidden === 'false') {
    qs.set('hidden', params.hidden);
  }
  if (params.clientQ) qs.set('clientQ', params.clientQ);
  if (params.createdFrom) qs.set('createdFrom', params.createdFrom);
  if (params.createdTo) qs.set('createdTo', params.createdTo);
  if (params.locationRegionSlug) {
    qs.set('locationRegionSlug', params.locationRegionSlug);
  }
  if (params.hasEstimate === 'true' || params.hasEstimate === 'false') {
    qs.set('hasEstimate', params.hasEstimate);
  }
  if (params.contractAmountMin) {
    qs.set('contractAmountMin', params.contractAmountMin);
  }
  if (params.contractAmountMax) {
    qs.set('contractAmountMax', params.contractAmountMax);
  }
  if (params.signedFrom) qs.set('signedFrom', params.signedFrom);
  if (params.signedTo) qs.set('signedTo', params.signedTo);
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.sortDir) qs.set('sortDir', params.sortDir);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));

  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await fetchWithAuth(`/api/admin/projects${suffix}`);
  if (!response.ok) {
    await parseError(response, 'Failed to load projects');
  }
  return response.json() as Promise<AdminProjectListPage>;
}

export async function adminHideProject(id: string): Promise<void> {
  const response = await fetchWithAuth(
    `/api/admin/projects/${encodeURIComponent(id)}/hide`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to hide project');
  }
}

export async function adminUnhideProject(id: string): Promise<void> {
  const response = await fetchWithAuth(
    `/api/admin/projects/${encodeURIComponent(id)}/unhide`,
    { method: 'POST' },
  );
  if (!response.ok) {
    await parseError(response, 'Failed to unhide project');
  }
}
