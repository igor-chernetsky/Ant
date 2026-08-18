import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { TenderingModule } from '../tendering/tendering.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [UsersModule, NotificationsModule, TenderingModule, DocumentsModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
