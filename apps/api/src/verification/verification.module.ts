import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { TenderingModule } from '../tendering/tendering.module';
import { UsersModule } from '../users/users.module';
import { AdminContractorsController } from './admin-contractors.controller';
import { AdminContractorsService } from './admin-contractors.service';
import { ContractorVerificationController } from './contractor-verification.controller';
import { ContractorVerificationService } from './contractor-verification.service';

@Module({
  imports: [UsersModule, AuthModule, StorageModule, NotificationsModule, TenderingModule],
  controllers: [ContractorVerificationController, AdminContractorsController],
  providers: [ContractorVerificationService, AdminContractorsService],
})
export class VerificationModule {}
