import { HomePageClient } from './home-client';
import {
  fetchPublicProjectsServer,
} from '@/lib/public-projects-server';
import { PUBLIC_PROJECTS_PAGE_SIZE } from '@/lib/public-projects';

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
