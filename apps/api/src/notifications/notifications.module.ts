import { Module } from '@nestjs/common';
import { LocalizationModule } from '../localization/localization.module';
import { LocationsModule } from '../locations/locations.module';
import { MailService } from './mail.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [LocationsModule, LocalizationModule],
  providers: [MailService, NotificationsService],
  exports: [NotificationsService, MailService],
})
export class NotificationsModule {}
