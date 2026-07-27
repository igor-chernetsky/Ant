import { Module } from '@nestjs/common';
import { LocalizationModule } from '../localization/localization.module';
import { LocationsModule } from '../locations/locations.module';
import { AdminPlatformSettingsController } from './admin-platform-settings.controller';
import { MailService } from './mail.service';
import { NotificationsService } from './notifications.service';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [LocationsModule, LocalizationModule],
  controllers: [AdminPlatformSettingsController],
  providers: [MailService, NotificationsService, PlatformSettingsService],
  exports: [NotificationsService, MailService, PlatformSettingsService],
})
export class NotificationsModule {}
