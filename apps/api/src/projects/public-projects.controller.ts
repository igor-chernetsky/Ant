import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { TagsService } from '../tags/tags.service';
import { ProjectsService } from './projects.service';

@Controller('v1/public')
export class PublicProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly tagsService: TagsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('projects')
  @UseGuards(OptionalJwtAuthGuard)
  async listProjects(
    @Req() req: Request & { user?: JwtPayload | null },
    @Query('tag') tagQuery?: string | string[],
    @Query('status') statusQuery?: string | string[],
  ) {
    const tagSlugs = normalizeTagQuery(tagQuery);
    const statuses = normalizeTagQuery(statusQuery);
    const userId = req.user
      ? (await this.usersService.findOrCreateFromJwt(req.user)).id
      : null;
    return this.projectsService.listDiscover(userId, tagSlugs, statuses);
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
