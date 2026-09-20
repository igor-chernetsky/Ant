import type { MetadataRoute } from 'next';
import { resolveAppBaseUrl } from '@/lib/app-base-url';
import {
  fetchPublicProjectServer,
  fetchPublicProjectsServer,
} from '@/lib/public-projects-server';
import { SITEMAP_PATHS } from '@/lib/seo';

/** Regenerate hourly so new projects and API changes reach crawlers. */
export const revalidate = 3600;

/**
 * The API clamps `limit` to DISCOVER_PAGE_SIZE_MAX (50), so a single request for
 * 200 projects silently returns 50. Page through instead.
 */
const SITEMAP_PAGE_SIZE = 50;
/** Safety valve so a broken `hasMore` flag cannot loop forever. */
const SITEMAP_MAX_PROJECTS = 2000;

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

/**
 * Whether `/projects/:id` is reachable by an anonymous visitor.
 *
 * Older API deployments answer 404 to guests for every discoverable project, so
 * advertising project URLs would fill Search Console with 404s. One probe
 * decides the whole sitemap; the hourly revalidation picks up the API deploy
 * automatically, in either deploy order.
 */
async function anonymousProjectDetailIsReachable(): Promise<boolean> {
  try {
    const page = await fetchPublicProjectsServer({ limit: 1, offset: 0 });
    const first = page.items.find((item) => !item.isHidden);
    if (!first) {
      return false;
    }
    return (await fetchPublicProjectServer(first.id)) !== null;
  } catch {
    return false;
  }
}

async function collectProjectEntries(
  base: string,
  lastModified: Date,
): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();

  for (
    let offset = 0;
    offset < SITEMAP_MAX_PROJECTS;
    offset += SITEMAP_PAGE_SIZE
  ) {
    let page;
    try {
      page = await fetchPublicProjectsServer({
        limit: SITEMAP_PAGE_SIZE,
        offset,
      });
    } catch {
      break;
    }

    if (page.items.length === 0) {
      break;
    }

    for (const project of page.items) {
      if (project.isHidden || seen.has(project.id)) continue;
      seen.add(project.id);
      entries.push({
        url: `${base}/projects/${project.id}`,
        lastModified: project.updatedAt
          ? new Date(project.updatedAt)
          : lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      });
    }

    if (!page.hasMore) {
      break;
    }
  }

  return entries;
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

  const projectEntries = (await anonymousProjectDetailIsReachable())
    ? await collectProjectEntries(base, lastModified)
    : [];

  return [...staticEntries, ...projectEntries];
}
