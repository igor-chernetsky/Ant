import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LocalizationModule } from '../localization/localization.module';
import { LocationsModule } from '../locations/locations.module';
import { AdminPlatformSettingsController } from './admin-platform-settings.controller';
import { ContactService } from './contact.service';
import { EmailUnsubscribeController } from './email-unsubscribe.controller';
import { MailService } from './mail.service';
import { NotificationsService } from './notifications.service';
import { PlatformSettingsService } from './platform-settings.service';
import { PublicContactController } from './public-contact.controller';
import { PublicPlatformFeesController } from './public-platform-fees.controller';

@Module({
  imports: [ScheduleModule.forRoot(), LocationsModule, LocalizationModule],
  controllers: [
    AdminPlatformSettingsController,
    EmailUnsubscribeController,
    PublicContactController,
    PublicPlatformFeesController,
  ],
  providers: [
    MailService,
    NotificationsService,
    PlatformSettingsService,
    ContactService,
  ],
  exports: [NotificationsService, MailService, PlatformSettingsService],
})
export class NotificationsModule {}
