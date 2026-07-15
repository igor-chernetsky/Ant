import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { resolveLocaleFromRequest } from '../localization/request-locale';
import { UsersService } from '../users/users.service';
import { TagsService } from '../tags/tags.service';
import { LocationsService } from '../locations/locations.service';
import { ProjectsService } from './projects.service';

@Controller('v1/public')
export class PublicProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly tagsService: TagsService,
    private readonly locationsService: LocationsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('projects')
  @UseGuards(OptionalJwtAuthGuard)
  async listProjects(
    @Req() req: Request & { user?: JwtPayload | null },
    @Query('tag') tagQuery?: string | string[],
    @Query('status') statusQuery?: string | string[],
    @Query('region') regionQuery?: string,
    @Query('area') areaQuery?: string,
    @Query('service') serviceQuery?: string | string[],
    @Query('ownership') ownershipQuery?: string | string[],
  ) {
    const tagSlugs = normalizeTagQuery(tagQuery);
    const statuses = normalizeTagQuery(statusQuery);
    const serviceSlugs = normalizeTagQuery(serviceQuery);
    const ownershipSlugs = normalizeTagQuery(ownershipQuery);
    const location = {
      regionSlug: regionQuery?.trim() || undefined,
      areaSlug: areaQuery?.trim() || undefined,
    };
    const user = req.user
      ? await this.usersService.findOrCreateFromJwt(req.user)
      : null;
    const locale = resolveLocaleFromRequest(req, user?.preferredLocale);
    return this.projectsService.listDiscover(
      user?.id ?? null,
      tagSlugs,
      statuses,
      location.regionSlug || location.areaSlug ? location : undefined,
      serviceSlugs,
      ownershipSlugs,
      locale,
    );
  }

  @Get('projects/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async getProject(
    @Req() req: Request & { user?: JwtPayload | null },
    @Param('id') id: string,
  ) {
    const user = req.user
      ? await this.usersService.findOrCreateFromJwt(req.user)
      : null;
    const locale = resolveLocaleFromRequest(req, user?.preferredLocale);
    const userId = user?.id ?? null;
    return this.projectsService.getPublicById(id, userId, locale);
  }

  @Get('tags')
  listTags() {
    return this.tagsService.listCatalog();
  }

  @Get('locations')
  listLocations() {
    return this.locationsService.listCatalog();
  }
}

function normalizeTagQuery(raw?: string | string[]): string[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return [...new Set(values.map((s) => s.trim()).filter(Boolean))];
}
