import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupplyDirectoryKind } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SupplyDirectoryService } from './supply-directory.service';

@Controller('v1/directory')
@UseGuards(JwtAuthGuard)
export class DirectoryController {
  constructor(private readonly directory: SupplyDirectoryService) {}

  @Get()
  list(
    @Query('kind') kind?: SupplyDirectoryKind,
    @Query('excludeRegistered') excludeRegistered?: string,
    @Query('locationRegionSlug') locationRegionSlug?: string,
    @Query('locationAreaSlug') locationAreaSlug?: string,
    @Query('tagSlugs') tagSlugsRaw?: string | string[],
  ) {
    const tagSlugs = Array.isArray(tagSlugsRaw)
      ? tagSlugsRaw
      : typeof tagSlugsRaw === 'string' && tagSlugsRaw.trim()
        ? tagSlugsRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

    return this.directory.listForInvite({
      kind,
      excludeRegistered:
        excludeRegistered === '1' ||
        excludeRegistered === 'true' ||
        excludeRegistered === 'yes',
      locationRegionSlug: locationRegionSlug?.trim() || undefined,
      locationAreaSlug: locationAreaSlug?.trim() || undefined,
      tagSlugs,
    });
  }
}
