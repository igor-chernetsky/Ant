import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LocalizationModule } from '../localization/localization.module';
import { LocationsModule } from '../locations/locations.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../storage/storage.module';
import { ProjectsModule } from '../projects/projects.module';
import { DocumentsModule } from '../documents/documents.module';
import { BidAnalysisService } from './bid-analysis.service';

import { BidOffersService } from './bid-offers.service';
import { BidMessagesService } from './bid-messages.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import { ContractorTenderController } from './contractor-tender.controller';
import { ProjectTenderController } from './project-tender.controller';
import { ProjectContractController } from './project-contract.controller';
import { TenderAutoCloseService } from './tender-auto-close.service';
import { TenderMatchingService } from './tender-matching.service';
import { TenderClarificationsService } from './tender-clarifications.service';
import { DefaultCostBreakdownService } from './default-cost-breakdown.service';
import { TendersService } from './tenders.service';
import { CommercialProposalService } from './commercial-proposal.service';
import { ContractsService } from './contracts.service';
import { HtmlToPdfService } from '../pdf/html-to-pdf.service';
import { ContractorPortfolioController } from './contractor-portfolio.controller';
import { ContractorPortfolioService } from './contractor-portfolio.service';
import { PublicContractorsController } from './public-contractors.controller';

@Module({
  imports: [
    UsersModule,
    AiModule,
    LocalizationModule,
    NotificationsModule,
    LocationsModule,
    ScheduleModule.forRoot(),
    StorageModule,
    ProjectsModule,
    DocumentsModule,
  ],
  controllers: [
    ProjectTenderController,
    ProjectContractController,
    ContractorTenderController,
    ContractorPortfolioController,
    PublicContractorsController,
  ],
  providers: [
    TendersService,
    BidAnalysisService,
    BidOffersService,
    BidMessagesService,
    ContractorProfilesService,
    TenderMatchingService,
    TenderAutoCloseService,
    CommercialProposalService,
    ContractsService,
    HtmlToPdfService,
    TenderClarificationsService,
    DefaultCostBreakdownService,
    ContractorPortfolioService,
  ],
  exports: [TendersService, ContractorProfilesService],
})
export class TenderingModule {}
