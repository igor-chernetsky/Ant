import type { Metadata } from 'next';
import { cache } from 'react';
import { JsonLd } from '@/components/JsonLd';
import { ProjectDetailPageClient } from './project-detail-client';
import { LockedProjectView } from './locked-project-view';
import { fetchPublicProjectServer } from '@/lib/public-projects-server';
import { isLockedPublicProject, type PublicProjectDetail } from '@/lib/public-projects';
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
 * expired token yields `null` and the client refetches after refreshing.
 *
 * Anonymous requests to a discoverable project now receive the API's locked
 * projection instead of a 404, which keeps project URLs indexable.
 */
const loadPublicProject = cache(
  async (
    id: string,
    inviteToken: string | null,
    locale: Locale,
  ): Promise<PublicProjectDetail | null> => {
    try {
      const { accessToken } = await readAuthCookies();
      return await fetchPublicProjectServer(id, {
        inviteToken,
        locale,
        accessToken,
      });
    } catch {
      return null;
    }
  },
);

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

  const project = await loadPublicProject(id, null, locale);

  if (!project || (!isLockedPublicProject(project) && project.isHidden)) {
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
  const project = await loadPublicProject(id, inviteToken, locale);
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
