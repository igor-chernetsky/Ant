import { Controller, Get, Param, Query } from '@nestjs/common';
import { TagsService } from '../tags/tags.service';
import { ProjectsService } from './projects.service';

@Controller('v1/public')
export class PublicProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly tagsService: TagsService,
  ) {}

  @Get('projects')
  listProjects(
    @Query('tag') tagQuery?: string | string[],
    @Query('status') statusQuery?: string | string[],
  ) {
    const tagSlugs = normalizeTagQuery(tagQuery);
    const statuses = normalizeTagQuery(statusQuery);
    return this.projectsService.listPublic(tagSlugs, statuses);
  }

  @Get('projects/:id')
  getProject(@Param('id') id: string) {
    return this.projectsService.getPublicById(id);
  }

  @Get('tags')
  listTags() {
    return this.tagsService.listCatalog();
  }
}

function normalizeTagQuery(raw?: string | string[]): string[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return [...new Set(values.map((s) => s.trim()).filter(Boolean))];
}
