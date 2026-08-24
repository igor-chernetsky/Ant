import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupplyDirectoryModule } from '../supply-directory/supply-directory.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [NotificationsModule, SupplyDirectoryModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
