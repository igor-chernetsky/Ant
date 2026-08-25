import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProjectStatus, ProjectType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProjectsService } from './projects.service';
import type {
  AdminProjectSortBy,
  AdminProjectSortDir,
} from './projects.types';

@Controller('v1/admin/projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('projectType') projectType?: string,
    @Query('hidden') hidden?: string,
    @Query('clientQ') clientQ?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
    @Query('locationRegionSlug') locationRegionSlug?: string,
    @Query('hasEstimate') hasEstimate?: string,
    @Query('contractAmountMin') contractAmountMin?: string,
    @Query('contractAmountMax') contractAmountMax?: string,
    @Query('signedFrom') signedFrom?: string,
    @Query('signedTo') signedTo?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parseBool = (value?: string): boolean | undefined => {
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      return undefined;
    };
    const parseAmount = (value?: string): number | undefined => {
      if (value == null || !value.trim()) return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    };

    const statusValue =
      status &&
      Object.values(ProjectStatus).includes(status as ProjectStatus)
        ? (status as ProjectStatus)
        : undefined;
    const typeValue =
      projectType &&
      Object.values(ProjectType).includes(projectType as ProjectType)
        ? (projectType as ProjectType)
        : undefined;
    const sortByValue: AdminProjectSortBy =
      sortBy === 'title' ||
      sortBy === 'estimate' ||
      sortBy === 'contractAmount' ||
      sortBy === 'signedAt'
        ? sortBy
        : 'createdAt';
    const sortDirValue: AdminProjectSortDir =
      sortDir === 'asc' ? 'asc' : 'desc';

    return this.projectsService.listForAdmin({
      q: q?.trim() || undefined,
      status: statusValue,
      projectType: typeValue,
      hidden: parseBool(hidden),
      clientQ: clientQ?.trim() || undefined,
      createdFrom: createdFrom?.trim() || undefined,
      createdTo: createdTo?.trim() || undefined,
      locationRegionSlug: locationRegionSlug?.trim() || undefined,
      hasEstimate: parseBool(hasEstimate),
      contractAmountMin: parseAmount(contractAmountMin),
      contractAmountMax: parseAmount(contractAmountMax),
      signedFrom: signedFrom?.trim() || undefined,
      signedTo: signedTo?.trim() || undefined,
      sortBy: sortByValue,
      sortDir: sortDirValue,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Delete(':id')
  async deleteOne(@Param('id') id: string) {
    await this.projectsService.deleteForAdmin(id);
    return { ok: true };
  }

  @Post(':id/complete')
  async completeOne(@Param('id') id: string) {
    await this.projectsService.completeForAdmin(id);
    return { ok: true };
  }

  @Post(':id/hide')
  async hideOne(@Param('id') id: string) {
    return this.projectsService.hideForAdmin(id);
  }

  @Post(':id/unhide')
  async unhideOne(@Param('id') id: string) {
    return this.projectsService.unhideForAdmin(id);
  }
}
