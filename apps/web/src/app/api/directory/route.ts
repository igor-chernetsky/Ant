import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const kind = url.searchParams.get('kind');
  const excludeRegistered = url.searchParams.get('excludeRegistered');
  const locationRegionSlug = url.searchParams.get('locationRegionSlug');
  const locationAreaSlug = url.searchParams.get('locationAreaSlug');
  if (kind) params.set('kind', kind);
  if (excludeRegistered) params.set('excludeRegistered', excludeRegistered);
  if (locationRegionSlug) params.set('locationRegionSlug', locationRegionSlug);
  if (locationAreaSlug) params.set('locationAreaSlug', locationAreaSlug);
  for (const slug of url.searchParams.getAll('tagSlugs')) {
    if (slug.trim()) params.append('tagSlugs', slug.trim());
  }
  const qs = params.toString() ? `?${params.toString()}` : '';
  return proxyBackendJson(`/v1/directory${qs}`);
}
