import type { Metadata } from 'next';
import { ProjectDetailPageClient } from './project-detail-client';
import { fetchPublicProjectServer } from '@/lib/public-projects-server';
import {
  noIndexMetadata,
  projectPageMetadata,
  truncateDescription,
} from '@/lib/seo';

type ProjectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: ProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const { invite } = await searchParams;

  let project = null;
  try {
    project = await fetchPublicProjectServer(id, {
      inviteToken: invite ?? null,
    });
  } catch {
    project = null;
  }

  if (!project || project.isHidden) {
    return noIndexMetadata();
  }

  const description = truncateDescription(
    project.description?.trim() ||
      project.brief?.summary?.trim() ||
      project.scopeSummary?.trim() ||
      'Construction project on BuilTHAI in Thailand.',
  );

  return projectPageMetadata({
    title: project.title,
    description,
    path: `/projects/${id}`,
  });
}

export default function ProjectDetailPage() {
  return <ProjectDetailPageClient />;
}
