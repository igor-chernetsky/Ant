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
import { TenderClarificationsService } from './tender-clarifications.service';
import { DefaultCostBreakdownService } from './default-cost-breakdown.service';
import { TendersService } from './tenders.service';
import { CommercialProposalService } from './commercial-proposal.service';
import { HtmlToPdfService } from '../pdf/html-to-pdf.service';

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
    HtmlToPdfService,
    TenderClarificationsService,
    DefaultCostBreakdownService,
  ],
  exports: [TendersService, ContractorProfilesService],
})
export class TenderingModule {}
