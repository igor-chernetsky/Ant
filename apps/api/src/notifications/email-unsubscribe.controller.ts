import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('v1/email')
export class EmailUnsubscribeController {
  constructor(private readonly notifications: NotificationsService) {}

  /**
   * One-click unsubscribe (RFC 8058) and manual GET confirmation.
   * Public — no JWT. Token is HMAC-signed.
   */
  @Post('unsubscribe')
  async unsubscribePost(@Query('token') token?: string) {
    return this.notifications.unsubscribeMatchingProjectsByToken(token);
  }

  @Get('unsubscribe')
  async unsubscribeGet(@Query('token') token?: string) {
    return this.notifications.unsubscribeMatchingProjectsByToken(token);
  }
}
