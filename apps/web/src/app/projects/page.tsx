import { noIndexMetadata } from '@/lib/seo';
import { ProjectsRedirectPageClient } from './projects-redirect-client';

export const metadata = noIndexMetadata();

export default function ProjectsRedirectPage() {
  return <ProjectsRedirectPageClient />;
}
