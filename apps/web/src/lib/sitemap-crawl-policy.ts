import type { PublicProjectCard } from '@/lib/public-projects';

/**
 * Should `/projects/:id` be advertised to crawlers?
 *
 * Search Console reported ~60 project URLs as "Discovered — currently not
 * indexed": the sitemap promised every project in the public list, including
 * archived `completed` ones and pages whose anonymous view is nothing but a
 * title. Those are exactly the URLs Google defers, and they compete for crawl
 * budget with the pages worth indexing.
 *
 * Rules:
 * - hidden projects are not public at all;
 * - `completed` projects are archived examples nobody can bid on (the discovery
 *   list includes them temporarily, the sitemap should not);
 * - a project without a description has no text for the anonymous (locked) view,
 *   so the page is thin by definition.
 */
export function shouldListProjectInSitemap(
  project: Pick<PublicProjectCard, 'status' | 'isHidden' | 'description'>,
): boolean {
  if (project.isHidden) {
    return false;
  }
  if (project.status === 'completed') {
    return false;
  }
  return Boolean(project.description?.trim());
}

/** Priority for a listed project: pages with more content rank above minimal ones. */
export function sitemapProjectPriority(
  project: Pick<PublicProjectCard, 'tags'>,
): number {
  return project.tags.length > 0 ? 0.6 : 0.4;
}
