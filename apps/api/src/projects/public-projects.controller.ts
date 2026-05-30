import { Controller, Get, Query } from '@nestjs/common';
import { TagsService } from '../tags/tags.service';
import { ProjectsService } from './projects.service';

@Controller('v1/public')
export class PublicProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly tagsService: TagsService,
  ) {}

  @Get('projects')
  listProjects(@Query('tag') tagQuery?: string | string[]) {
    const tagSlugs = normalizeTagQuery(tagQuery);
    return this.projectsService.listPublic(tagSlugs);
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
