import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { NotificationsService } from '../notifications/notifications.service';
import {
  MarkInAppNotificationsReadDto,
  UpdateNotificationPreferencesDto,
} from '../notifications/notification.types';
import { UpdateLocaleDto } from './locale.types';
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
    return this.usersService.buildMeResponse(user, req.user);
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

  @Get('me/notifications')
  @UseGuards(JwtAuthGuard)
  async listNotifications(
    @Req() req: Request & { user: JwtPayload },
    @Query('limit') limitRaw?: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.notifications.listInAppNotifications(user.id, {
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Post('me/notifications/read')
  @UseGuards(JwtAuthGuard)
  async markNotificationsRead(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: MarkInAppNotificationsReadDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.notifications.markInAppNotificationsRead(user.id, body ?? {});
  }

  @Patch('me/locale')
  @UseGuards(JwtAuthGuard)
  async updateLocale(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: UpdateLocaleDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.usersService.updatePreferredLocale(user.id, body.locale);
  }
}
