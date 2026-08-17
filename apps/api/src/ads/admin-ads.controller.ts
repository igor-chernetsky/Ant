import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdsService } from './ads.service';
import type { UpsertHomeAdSlideDto } from './ads.types';

@Controller('v1/admin/ads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAdsController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  list() {
    return this.ads.listAdmin();
  }

  @Post()
  create(@Body() body: UpsertHomeAdSlideDto) {
    return this.ads.create(body ?? {});
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpsertHomeAdSlideDto) {
    return this.ads.update(id, body ?? {});
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.ads.remove(id);
    return { ok: true };
  }
}
