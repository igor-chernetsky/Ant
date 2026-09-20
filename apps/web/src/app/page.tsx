import type { Metadata } from 'next';
import { HomePageClient } from './home-client';
import {
  fetchPublicProjectsServer,
} from '@/lib/public-projects-server';
import { PUBLIC_PROJECTS_PAGE_SIZE } from '@/lib/public-projects';

/**
 * The home page also hosts the faceted project search (`/?tag=…&region=…`).
 * Canonicalising to `/` consolidates those variants; title/description come
 * from the root layout, which localises them.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  let initialPublicProjects = null;

  try {
    initialPublicProjects = await fetchPublicProjectsServer({
      limit: PUBLIC_PROJECTS_PAGE_SIZE,
      offset: 0,
    });
  } catch {
    initialPublicProjects = null;
  }

  return <HomePageClient initialPublicProjects={initialPublicProjects} />;
}
