import { getBackendApiUrl } from '@/lib/auth-server';
import {
  LOCALE_REQUEST_HEADER,
  readLocaleFromCookieHeader,
} from '@/lib/locale-request';
import type {
  PublicProjectListFilters,
  PublicProjectListPage,
} from '@/lib/public-projects';
import type { Project } from '@/lib/projects';

async function fetchBackendJson<T>(
  path: string,
  options?: { locale?: string; revalidate?: number },
): Promise<T | null> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options?.locale) {
    headers[LOCALE_REQUEST_HEADER] = options.locale;
  }

  const response = await fetch(`${getBackendApiUrl()}${path}`, {
    headers,
    next:
      options?.revalidate != null
        ? { revalidate: options.revalidate }
        : undefined,
    cache: options?.revalidate != null ? undefined : 'no-store',
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchPublicProjectsServer(
  filters: PublicProjectListFilters = {},
  options?: { locale?: string },
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
  if (filters.regionSlug) {
    params.append('region', filters.regionSlug);
  }
  if (filters.areaSlug) {
    params.append('area', filters.areaSlug);
  }
  if (filters.limit != null) {
    params.set('limit', String(filters.limit));
  }
  if (filters.offset != null) {
    params.set('offset', String(filters.offset));
  }

  const qs = params.toString();
  const data = await fetchBackendJson<
    PublicProjectListPage | PublicProjectListPage['items']
  >(`/v1/public/projects${qs ? `?${qs}` : ''}`, {
    locale: options?.locale,
    revalidate: 300,
  });

  if (!data) {
    return {
      items: [],
      total: 0,
      limit: filters.limit ?? 0,
      offset: filters.offset ?? 0,
      hasMore: false,
    };
  }

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

export async function fetchPublicProjectServer(
  id: string,
  options?: { locale?: string; inviteToken?: string | null },
): Promise<Project | null> {
  const invite = options?.inviteToken?.trim();
  const qs = invite ? `?invite=${encodeURIComponent(invite)}` : '';

  return fetchBackendJson<Project>(
    `/v1/public/projects/${encodeURIComponent(id)}${qs}`,
    { locale: options?.locale },
  );
}

export async function readRequestLocale(
  cookieHeader: string | null | undefined,
): Promise<string> {
  return readLocaleFromCookieHeader(cookieHeader);
}
