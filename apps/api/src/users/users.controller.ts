import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateNotificationPreferencesDto } from '../notifications/notification.types';
import { UsersService } from './users.service';

@Controller('v1')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    const roles = req.user.realm_access?.roles ?? [];
    const hasContractorProfile = await this.usersService.isContractor(user.id);
    const isContractor =
      roles.includes('contractor') || hasContractorProfile;
    return {
      id: user.id,
      keycloakSub: user.keycloakSub,
      email: user.email,
      displayName: user.displayName,
      roles,
      isContractor,
    };
  }

  @Get('me/notification-preferences')
  @UseGuards(JwtAuthGuard)
  async notificationPreferences(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.notifications.getOrCreatePreferences(user.id);
  }

  @Patch('me/notification-preferences')
  @UseGuards(JwtAuthGuard)
  async updateNotificationPreferences(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.notifications.updatePreferences(user.id, body);
  }
}
