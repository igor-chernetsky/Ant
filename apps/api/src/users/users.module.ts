import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupplyDirectoryModule } from '../supply-directory/supply-directory.module';
import { AdminClientsController } from './admin-clients.controller';
import { AdminClientsService } from './admin-clients.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [NotificationsModule, SupplyDirectoryModule],
  controllers: [UsersController, AdminClientsController],
  providers: [UsersService, AdminClientsService],
  exports: [UsersService],
})
export class UsersModule {}
