import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from '../users/users.module';
import { ContractorProfilesService } from './contractor-profiles.service';
import { ContractorTenderController } from './contractor-tender.controller';
import { ProjectTenderController } from './project-tender.controller';
import { TenderAutoCloseService } from './tender-auto-close.service';
import { TenderMatchingService } from './tender-matching.service';
import { TendersService } from './tenders.service';

@Module({
  imports: [UsersModule, ScheduleModule.forRoot()],
  controllers: [ProjectTenderController, ContractorTenderController],
  providers: [
    TendersService,
    ContractorProfilesService,
    TenderMatchingService,
    TenderAutoCloseService,
  ],
  exports: [TendersService, ContractorProfilesService],
})
export class TenderingModule {}
