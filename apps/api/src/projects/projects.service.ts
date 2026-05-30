import {

  BadRequestException,

  ForbiddenException,

  Inject,

  Injectable,

  NotFoundException,

  forwardRef,

} from '@nestjs/common';

import { Prisma, Project, ProjectStatus, ProjectTag, ProjectType, Tag } from '@prisma/client';
import { IntakeService } from '../intake/intake.service';
import { EstimatesService } from '../estimation/estimates.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

import {

  buildInitialBrief,

  computeReadinessScore,

} from './project-brief';

import {

  CreateProjectDto,

  ProjectResponse,

  ProjectTagResponse,

} from './projects.types';

const DELETABLE_STATUSES: ProjectStatus[] = [
  ProjectStatus.draft,
  ProjectStatus.intake,
  ProjectStatus.ready_for_estimate,
];



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
    private readonly storage: StorageService,
    @Inject(forwardRef(() => IntakeService))
    private readonly intakeService: IntakeService,
    private readonly estimatesService: EstimatesService,
  ) {}



  private mapTags(project: ProjectWithTags): ProjectTagResponse[] {

    return project.tags.map((pt) => ({

      slug: pt.tag.slug,

      label: pt.tag.label,

      source: pt.source,

      groupSlug: pt.tag.group?.slug ?? null,

    }));

  }



  toResponse(
    project: ProjectWithTags,
    estimate: ProjectResponse['estimate'] = null,
  ): ProjectResponse {

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

      estimate,

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

    return projects.map((project) => this.toResponse(project, null));

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



    const estimate = await this.prisma.estimate.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return this.toResponse(
      project,
      estimate ? this.estimatesService.toResponse(estimate) : null,
    );
  }

  async deleteForClient(clientId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { documents: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    if (!DELETABLE_STATUSES.includes(project.status)) {
      throw new BadRequestException(
        'Project cannot be deleted after estimation or tendering has started',
      );
    }

    if (this.storage.isConfigured()) {
      for (const doc of project.documents) {
        try {
          await this.storage.deleteObject(doc.storageKey);
        } catch {
          // Best-effort S3 cleanup
        }
      }
    }

    await this.prisma.project.delete({ where: { id: projectId } });
  }
}
