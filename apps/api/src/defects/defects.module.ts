import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { TenderingModule } from '../tendering/tendering.module';
import { DefectsController } from './defects.controller';
import { DefectsService } from './defects.service';

@Module({
  imports: [UsersModule, NotificationsModule, TenderingModule],
  controllers: [DefectsController],
  providers: [DefectsService],
  exports: [DefectsService],
})
export class DefectsModule {}
