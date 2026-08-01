import { getBackendApiUrl } from '@/lib/auth-server';
import { getClientLocaleHeaders } from '@/lib/locale-request';

export interface PublicProjectTag {
  slug: string;
  label: string;
}

export interface PublicProjectEstimateSummary {
  minAmount: number;
  maxAmount: number;
  midAmount: number;
  currency: string;
  confidence: number;
}

export interface PublicProjectCard {
  id: string;
  title: string;
  description: string | null;
  projectType: string;
  district: string | null;
  locationRegionSlug?: string;
  locationAreaSlug?: string | null;
  locationNote?: string | null;
  regionCode: string;
  status: string;
  isHidden: boolean;
  readinessScore: number;
  tags: PublicProjectTag[];
  coverImageUrl: string | null;
  updatedAt: string;
  applicationsDeadlinePassed?: boolean;
  canOpenDetail?: boolean;
  /** Ballpark — only present for the owning client. */
  estimate?: PublicProjectEstimateSummary | null;
}

import type { ProjectTrack } from '@/lib/service-filters';

export interface PublicProjectListFilters {
  tags?: string[];
  statuses?: string[];
  regionSlug?: string;
  areaSlug?: string;
  projectTrack?: ProjectTrack | null;
  propertyTypes?: string[];
  limit?: number;
  offset?: number;
}

export const PUBLIC_PROJECTS_PAGE_SIZE = 30;

export interface PublicProjectListPage {
  items: PublicProjectCard[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export async function fetchPublicProjects(
  filters: PublicProjectListFilters = {},
): Promise<PublicProjectListPage> {
  const tagSlugs = filters.tags ?? [];
  const statuses = filters.statuses ?? [];
  const projectTrack = filters.projectTrack ?? null;
  const propertyTypes = filters.propertyTypes ?? [];
  const params = new URLSearchParams();
  for (const slug of tagSlugs) {
    params.append('tag', slug);
  }
  for (const status of statuses) {
    params.append('status', status);
  }
  if (projectTrack) {
    params.append('track', projectTrack);
  }
  for (const propertyType of propertyTypes) {
    params.append('propertyType', propertyType);
  }
  if (filters.regionSlug?.trim()) {
    params.append('region', filters.regionSlug.trim());
  }
  if (filters.areaSlug?.trim()) {
    params.append('area', filters.areaSlug.trim());
  }
  params.set(
    'limit',
    String(filters.limit ?? PUBLIC_PROJECTS_PAGE_SIZE),
  );
  params.set('offset', String(filters.offset ?? 0));
  const qs = params.toString();
  const response = await fetch(
    `/api/public/projects${qs ? `?${qs}` : ''}`,
    {
      cache: 'no-store',
      headers: getClientLocaleHeaders(),
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load projects');
  }

  const data = (await response.json()) as
    | PublicProjectListPage
    | PublicProjectCard[];

  // Backward-compatible if an older API still returns a bare array.
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      limit: data.length,
      offset: 0,
      hasMore: false,
    };
  }

  return data;
}

import type { Project } from '@/lib/projects';

export async function fetchPublicProject(
  id: string,
  options?: { inviteToken?: string | null },
): Promise<Project> {
  const invite = options?.inviteToken?.trim();
  const qs = invite ? `?invite=${encodeURIComponent(invite)}` : '';
  const response = await fetch(
    `/api/public/projects/${encodeURIComponent(id)}${qs}`,
    {
      cache: 'no-store',
      headers: getClientLocaleHeaders(),
    },
  );

  if (response.status === 404) {
    throw new Error('NOT_FOUND');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load project');
  }

  return response.json() as Promise<Project>;
}

export async function fetchContractorParticipantProject(
  id: string,
): Promise<Project> {
  const { fetchWithAuth } = await import('@/lib/auth-client');
  const response = await fetchWithAuth(
    `/api/contractor/projects/${encodeURIComponent(id)}/view`,
  );

  if (response.status === 404) {
    throw new Error('NOT_FOUND');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load project');
  }

  return response.json() as Promise<Project>;
}

export async function fetchPublicTags(): Promise<
  Array<{
    slug: string;
    label: string;
    groupSlug: string | null;
    groupLabel: string | null;
  }>
> {
  const response = await fetch('/api/public/tags', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load tags');
  }
  return response.json() as Promise<
    Array<{
      slug: string;
      label: string;
      groupSlug: string | null;
      groupLabel: string | null;
    }>
  >;
}
