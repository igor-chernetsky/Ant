import type { MetadataRoute } from 'next';
import { resolveAppBaseUrl } from '@/lib/app-base-url';
import { fetchPublicProjectsServer } from '@/lib/public-projects-server';
import { SITEMAP_PATHS } from '@/lib/seo';

function sitemapPriority(path: (typeof SITEMAP_PATHS)[number]): number {
  if (path === '/') return 1;
  if (path.startsWith('/for-')) return 0.9;
  return 0.7;
}

function sitemapChangeFrequency(
  path: (typeof SITEMAP_PATHS)[number],
): MetadataRoute.Sitemap[number]['changeFrequency'] {
  return path === '/' ? 'daily' : 'monthly';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = resolveAppBaseUrl();
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = SITEMAP_PATHS.map((path) => ({
    url: path === '/' ? base : `${base}${path}`,
    lastModified,
    changeFrequency: sitemapChangeFrequency(path),
    priority: sitemapPriority(path),
  }));

  let projectEntries: MetadataRoute.Sitemap = [];
  try {
    const page = await fetchPublicProjectsServer({ limit: 200, offset: 0 });
    projectEntries = page.items
      .filter((project) => !project.isHidden)
      .map((project) => ({
        url: `${base}/projects/${project.id}`,
        lastModified: project.updatedAt
          ? new Date(project.updatedAt)
          : lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
  } catch {
    projectEntries = [];
  }

  return [...staticEntries, ...projectEntries];
}
