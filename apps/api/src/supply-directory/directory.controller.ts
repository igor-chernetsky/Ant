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
  ) {
    return this.directory.listActive(kind, {
      excludeRegistered:
        excludeRegistered === '1' || excludeRegistered === 'true',
    });
  }
}
