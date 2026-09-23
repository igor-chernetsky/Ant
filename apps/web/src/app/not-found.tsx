import { NotFoundView } from './not-found-view';
import { noIndexMetadata } from '@/lib/seo';

/**
 * Replaces the framework default ("404: This page could not be found.") with a
 * branded page. Next.js keeps the HTTP 404 status; `noIndexMetadata` states the
 * intent explicitly instead of relying on that default.
 */
export const metadata = noIndexMetadata();

export default function NotFound() {
  return <NotFoundView />;
}
