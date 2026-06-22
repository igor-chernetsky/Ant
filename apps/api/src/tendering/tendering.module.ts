import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { BidAnalysisService } from './bid-analysis.service';
import { BidOffersService } from './bid-offers.service';
import { BidMessagesService } from './bid-messages.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import { ContractorTenderController } from './contractor-tender.controller';
import { ProjectTenderController } from './project-tender.controller';
import { TenderAutoCloseService } from './tender-auto-close.service';
import { TenderMatchingService } from './tender-matching.service';
import { TendersService } from './tenders.service';
import { CommercialProposalService } from './commercial-proposal.service';

@Module({
  imports: [UsersModule, AiModule, NotificationsModule, ScheduleModule.forRoot()],
  controllers: [ProjectTenderController, ContractorTenderController],
  providers: [
    TendersService,
    BidAnalysisService,
    BidOffersService,
    BidMessagesService,
    ContractorProfilesService,
    TenderMatchingService,
    TenderAutoCloseService,
    CommercialProposalService,
  ],
  exports: [TendersService, ContractorProfilesService],
})
export class TenderingModule {}
