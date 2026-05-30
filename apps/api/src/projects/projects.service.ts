import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma, Project, ProjectTag, ProjectType, Tag, TagSource } from '@prisma/client';
import { IntakeService } from '../intake/intake.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildInitialBrief,
  computeReadinessScore,
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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => IntakeService))
    private readonly intakeService: IntakeService,
  ) {}

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

    const brief = buildInitialBrief({
      description: dto.description,
      propertyType: dto.propertyType ?? null,
      originalNarrative: dto.description,
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
        readinessScore: computeReadinessScore({
          title,
          description: dto.description,
          projectType: dto.projectType ?? ProjectType.other,
          propertyType: dto.propertyType ?? null,
          district: dto.district,
          tagCount: 0,
          brief,
        }),
        briefJson: brief as unknown as Prisma.InputJsonValue,
      },
      include: this.includeTags(),
    });

    await this.intakeService.runInitialIntakeForProject(project.id);

    return this.getForClient(clientId, project.id);
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
