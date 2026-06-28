import { getBackendApiUrl } from '@/lib/auth-server';

export interface PublicProjectTag {
  slug: string;
  label: string;
}

export interface PublicProjectCard {
  id: string;
  title: string;
  description: string | null;
  projectType: string;
  district: string | null;
  regionCode: string;
  status: string;
  readinessScore: number;
  tags: PublicProjectTag[];
  coverImageUrl: string | null;
  updatedAt: string;
}

export async function fetchPublicProjects(
  tagSlugs: string[] = [],
  statuses: string[] = [],
): Promise<PublicProjectCard[]> {
  const params = new URLSearchParams();
  for (const slug of tagSlugs) {
    params.append('tag', slug);
  }
  for (const status of statuses) {
    params.append('status', status);
  }
  const qs = params.toString();
  const response = await fetch(
    `/api/public/projects${qs ? `?${qs}` : ''}`,
    { cache: 'no-store' },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Failed to load projects');
  }

  return response.json() as Promise<PublicProjectCard[]>;
}

import type { Project } from '@/lib/projects';

export async function fetchPublicProject(id: string): Promise<Project> {
  const response = await fetch(
    `/api/public/projects/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
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
