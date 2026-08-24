import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  PlatformSettingsService,
  type SendAdminBroadcastDto,
  type UpdatePlatformSettingsDto,
} from './platform-settings.service';

@Controller('v1/admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminPlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  get() {
    return this.settings.getSettings();
  }

  @Patch()
  update(@Body() body: UpdatePlatformSettingsDto) {
    return this.settings.updateSettings(body);
  }

  @Post('broadcast')
  broadcast(@Body() body: SendAdminBroadcastDto) {
    return this.settings.sendAdminBroadcast(body);
  }
}
