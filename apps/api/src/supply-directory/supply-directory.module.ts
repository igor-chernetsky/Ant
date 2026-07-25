import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminDirectoryController } from './admin-directory.controller';
import { DirectoryController } from './directory.controller';
import { SupplyDirectoryService } from './supply-directory.service';
import { TenderInvitesService } from './tender-invites.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminDirectoryController, DirectoryController],
  providers: [SupplyDirectoryService, TenderInvitesService],
  exports: [SupplyDirectoryService, TenderInvitesService],
})
export class SupplyDirectoryModule {}
