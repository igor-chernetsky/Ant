import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Project, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, ProjectResponse } from './projects.types';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  toResponse(project: Project): ProjectResponse {
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      regionCode: project.regionCode,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async listForClient(clientId: string): Promise<ProjectResponse[]> {
    const projects = await this.prisma.project.findMany({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
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

    const project = await this.prisma.project.create({
      data: {
        clientId,
        title,
        description: dto.description?.trim() || null,
        regionCode: dto.regionCode?.trim() || 'TH',
        status: ProjectStatus.draft,
      },
    });

    return this.toResponse(project);
  }

  async getForClient(
    clientId: string,
    projectId: string,
  ): Promise<ProjectResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
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
