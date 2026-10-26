import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { JsonLd } from '@/components/JsonLd';
import { ProjectDetailPageClient } from './project-detail-client';
import { LockedProjectView } from './locked-project-view';
import { fetchPublicProjectServer } from '@/lib/public-projects-server';
import { isLockedPublicProject, type PublicProjectDetail } from '@/lib/public-projects';
import { readGuestProjectToken } from '@/lib/guest-project';
import {
  resolveProjectPageDecision,
  type ProjectPageLoadState,
} from '@/lib/project-page-state';
import { breadcrumbJsonLd } from '@/lib/seo-jsonld';
import {
  breadcrumbTrail,
  noIndexMetadata,
  projectPageMetadata,
  truncateDescription,
} from '@/lib/seo';
import { resolveServerLocale } from '@/lib/server-locale';
import { readAuthCookies } from '@/lib/auth-tokens';
import { translate, type Locale } from '@/lib/i18n';

type ProjectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
};

/**
 * One backend call per request, shared by `generateMetadata` and the page body
 * (React `cache` dedupes it) so the project is both in `<head>` and in the
 * server-rendered HTML.
 *
 * The viewer's own access token is forwarded when present, so owners,
 * participants and admins get their ACL applied during server rendering. An
 * expired token yields an `error` state and the client refetches after refreshing.
 *
 * A 404 from the public endpoint is ambiguous — the project may be deleted, or it
 * may simply not be public yet (a guest draft) — so the caller decides with
 * `resolveProjectPageDecision` once it knows whether the request holds a session,
 * a guest token or an invite.
 *
 * Anonymous requests to a discoverable project receive the API's locked
 * projection instead of a 404, which keeps project URLs indexable.
 */
const loadPublicProject = cache(
  async (
    id: string,
    inviteToken: string | null,
    locale: Locale,
  ): Promise<
    | { state: 'ok'; project: PublicProjectDetail }
    | { state: 'missing' }
    | { state: 'error' }
  > => {
    try {
      const { accessToken } = await readAuthCookies();
      const project = await fetchPublicProjectServer(id, {
        inviteToken,
        locale,
        accessToken,
      });
      return project ? { state: 'ok', project } : { state: 'missing' };
    } catch {
      return { state: 'error' };
    }
  },
);

/** Cookies that could unlock a non-public project for this caller. */
async function requestHasProjectCredentials(
  projectId: string,
): Promise<boolean> {
  const [auth, guestToken] = await Promise.all([
    readAuthCookies().catch(() => ({ accessToken: null, refreshToken: null })),
    readGuestProjectToken(projectId).catch(() => null),
  ]);
  return Boolean(auth.accessToken || auth.refreshToken || guestToken);
}

function projectDescription(
  project: PublicProjectDetail,
  locale: Locale,
): string {
  return truncateDescription(
    project.description?.trim() ||
      (!isLockedPublicProject(project) && project.scopeSummary?.trim()) ||
      (!isLockedPublicProject(project) && project.brief?.summary?.trim()) ||
      translate(locale, 'seo.projectFallbackDescription'),
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: ProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const { invite } = await searchParams;
  const locale = await resolveServerLocale();

  // An invite token can unlock a project that is not publicly listed — never
  // index or canonicalise a URL that carries it.
  if (invite?.trim()) {
    return noIndexMetadata();
  }

  const loaded = await loadPublicProject(id, null, locale);

  if (loaded.state !== 'ok') {
    return noIndexMetadata();
  }

  const project = loaded.project;
  if (!isLockedPublicProject(project) && project.isHidden) {
    return noIndexMetadata();
  }

  return projectPageMetadata({
    title: project.title,
    description: projectDescription(project, locale),
    path: `/projects/${id}`,
    locale,
  });
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const { id } = await params;
  const { invite } = await searchParams;
  const locale = await resolveServerLocale();

  const inviteToken = invite?.trim() || null;
  const loaded = await loadPublicProject(id, inviteToken, locale);

  const hasCredentials =
    loaded.state === 'missing' && !inviteToken
      ? await requestHasProjectCredentials(id)
      : false;

  const decision = resolveProjectPageDecision({
    state: loaded.state as ProjectPageLoadState,
    hasCredentials,
    hasInviteToken: Boolean(inviteToken),
  });

  if (decision === 'not-found') {
    notFound();
  }

  const project = loaded.state === 'ok' ? loaded.project : null;
  const indexable = Boolean(
    project &&
      !inviteToken &&
      (isLockedPublicProject(project) || !project.isHidden),
  );

  return (
    <>
      {indexable && project && (
        <JsonLd
          data={breadcrumbJsonLd(
            breadcrumbTrail(locale, {
              name: project.title,
              path: `/projects/${id}`,
            }),
          )}
        />
      )}
      {isLockedPublicProject(project) ? (
        <LockedProjectView project={project} />
      ) : (
        <ProjectDetailPageClient initialProject={project} />
      )}
    </>
  );
}
