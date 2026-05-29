import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Project, ProjectTag, ProjectType, Tag, TagSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildInitialBrief,
  computeReadinessScore,
  slugifyTagLabel,
  suggestTagSlugsFromText,
} from './project-brief';
import {
  CreateProjectDto,
  ProjectResponse,
  ProjectTagResponse,
} from './projects.types';

type ProjectWithTags = Project & {
  tags: Array<
    ProjectTag & {
      tag: Tag & { group: { slug: string } | null };
    }
  >;
};

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapTags(project: ProjectWithTags): ProjectTagResponse[] {
    return project.tags.map((pt) => ({
      slug: pt.tag.slug,
      label: pt.tag.label,
      source: pt.source,
      groupSlug: pt.tag.group?.slug ?? null,
    }));
  }

  toResponse(project: ProjectWithTags): ProjectResponse {
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      propertyType: project.propertyType,
      district: project.district,
      regionCode: project.regionCode,
      status: project.status,
      readinessScore: project.readinessScore,
      brief: project.briefJson as ProjectResponse['brief'],
      tags: this.mapTags(project),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private includeTags() {
    return {
      tags: {
        include: {
          tag: { include: { group: true } },
        },
      },
    } satisfies Prisma.ProjectInclude;
  }

  private async resolveClientTags(
    clientSlugs: string[],
    newLabels: string[],
  ): Promise<Array<{ tagId: string; source: TagSource }>> {
    const slugSet = new Set(clientSlugs.map((s) => s.trim()).filter(Boolean));

    for (const label of newLabels) {
      const trimmed = label.trim();
      if (!trimmed) continue;
      const slug = slugifyTagLabel(trimmed);
      if (!slug) {
        throw new BadRequestException(`Invalid tag label: ${label}`);
      }
      const tag = await this.prisma.tag.upsert({
        where: { slug },
        create: { slug, label: trimmed, isSystem: false },
        update: {},
      });
      slugSet.add(tag.slug);
    }

    if (slugSet.size === 0) {
      return [];
    }

    const tags = await this.prisma.tag.findMany({
      where: { slug: { in: [...slugSet] } },
    });

    if (tags.length !== slugSet.size) {
      const found = new Set(tags.map((t) => t.slug));
      const missing = [...slugSet].filter((s) => !found.has(s));
      throw new BadRequestException(`Unknown tag slugs: ${missing.join(', ')}`);
    }

    return tags.map((tag) => ({
      tagId: tag.id,
      source: TagSource.client,
    }));
  }

  private async resolveAiTags(
    slugs: string[],
  ): Promise<Array<{ tagId: string; source: TagSource }>> {
    if (slugs.length === 0) {
      return [];
    }

    const tags = await this.prisma.tag.findMany({
      where: { slug: { in: slugs } },
    });

    return tags.map((tag) => ({
      tagId: tag.id,
      source: TagSource.ai,
    }));
  }

  async listForClient(clientId: string): Promise<ProjectResponse[]> {
    const projects = await this.prisma.project.findMany({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
      include: this.includeTags(),
    });
    return projects.map((project) => this.toResponse(project));
  }

  async createForClient(
    clientId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectResponse> {
    const title = dto.title.trim();
    if (title.length < 3) {
      throw new BadRequestException('Title must be at least 3 characters');
    }

    const narrative = [title, dto.description ?? ''].join(' ').trim();
    const clientSlugs = dto.tagSlugs ?? [];
    const newLabels = dto.newTagLabels ?? [];

    const clientAssignments = await this.resolveClientTags(
      clientSlugs,
      newLabels,
    );

    const clientSlugSet = new Set(clientSlugs);
    for (const label of newLabels) {
      const slug = slugifyTagLabel(label);
      if (slug) clientSlugSet.add(slug);
    }

    const aiSuggestedSlugs = suggestTagSlugsFromText(narrative).filter(
      (slug) => !clientSlugSet.has(slug),
    );
    const aiAssignments = await this.resolveAiTags(aiSuggestedSlugs);

    const allAssignments = [...clientAssignments];
    const existingIds = new Set(allAssignments.map((a) => a.tagId));
    for (const ai of aiAssignments) {
      if (!existingIds.has(ai.tagId)) {
        allAssignments.push(ai);
        existingIds.add(ai.tagId);
      }
    }

    const brief = buildInitialBrief({
      description: dto.description,
      propertyType: dto.propertyType ?? null,
      originalNarrative: dto.description,
    });

    const readinessScore = computeReadinessScore({
      title,
      description: dto.description,
      projectType: dto.projectType ?? ProjectType.other,
      propertyType: dto.propertyType ?? null,
      district: dto.district,
      tagCount: allAssignments.length,
      brief,
    });

    const project = await this.prisma.project.create({
      data: {
        clientId,
        title,
        description: dto.description?.trim() || null,
        projectType: dto.projectType ?? ProjectType.other,
        propertyType: dto.propertyType ?? null,
        district: dto.district?.trim() || null,
        regionCode: dto.regionCode?.trim() || 'TH',
        readinessScore,
        briefJson: brief as unknown as Prisma.InputJsonValue,
        tags: {
          create: allAssignments.map((a) => ({
            tagId: a.tagId,
            source: a.source,
          })),
        },
      },
      include: this.includeTags(),
    });

    return this.toResponse(project);
  }

  async getForClient(
    clientId: string,
    projectId: string,
  ): Promise<ProjectResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: this.includeTags(),
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    return this.toResponse(project);
  }
}
