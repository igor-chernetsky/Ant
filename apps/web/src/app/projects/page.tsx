import { permanentRedirect } from 'next/navigation';

/**
 * `/projects` is not a page: the project list lives on the home page. A real
 * HTTP redirect replaces the previous client-side `router.replace('/')`, which
 * served a thin "Redirecting…" document that search engines can bucket as a
 * soft 404.
 *
 * Nothing links here (the header only used the path for active-nav state).
 */
export default function ProjectsRedirectPage(): never {
  permanentRedirect('/');
}
