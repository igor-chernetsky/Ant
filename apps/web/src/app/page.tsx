import type { Metadata } from 'next';
import { HomePageClient } from './home-client';
import {
  fetchPublicProjectsServer,
} from '@/lib/public-projects-server';
import { PUBLIC_PROJECTS_PAGE_SIZE } from '@/lib/public-projects';
import { resolveServerLocale } from '@/lib/server-locale';

/**
 * The home page also hosts the faceted project search (`/?tag=…&region=…`).
 * Canonicalising to `/` consolidates those variants; title/description come
 * from the root layout, which localises them.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  // Ask the API for the same language the page is rendered in, otherwise the
  // first paint shows English project cards under a localised shell.
  const locale = await resolveServerLocale();
  let initialPublicProjects = null;

  try {
    initialPublicProjects = await fetchPublicProjectsServer(
      {
        limit: PUBLIC_PROJECTS_PAGE_SIZE,
        offset: 0,
      },
      { locale },
    );
  } catch {
    initialPublicProjects = null;
  }

  return <HomePageClient initialPublicProjects={initialPublicProjects} />;
}
