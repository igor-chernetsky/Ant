import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ContractorProfilesService } from './contractor-profiles.service';
import { ContractorTenderController } from './contractor-tender.controller';
import { ProjectTenderController } from './project-tender.controller';
import { TenderMatchingService } from './tender-matching.service';
import { TendersService } from './tenders.service';

@Module({
  imports: [UsersModule],
  controllers: [ProjectTenderController, ContractorTenderController],
  providers: [TendersService, ContractorProfilesService, TenderMatchingService],
  exports: [TendersService],
})
export class TenderingModule {}
