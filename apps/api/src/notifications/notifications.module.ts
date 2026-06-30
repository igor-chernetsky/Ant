import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { MailService } from './mail.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [LocationsModule],
  providers: [MailService, NotificationsService],
  exports: [NotificationsService, MailService],
})
export class NotificationsModule {}
