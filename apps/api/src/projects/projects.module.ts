import { Module, forwardRef } from '@nestjs/common';

import { EstimationModule } from '../estimation/estimation.module';
import { AiModule } from '../ai/ai.module';
import { IntakeModule } from '../intake/intake.module';
import { LocalizationModule } from '../localization/localization.module';
import { LocationsModule } from '../locations/locations.module';
import { TagsModule } from '../tags/tags.module';
import { UsersModule } from '../users/users.module';
import { DocumentsModule } from '../documents/documents.module';
import { SupplyDirectoryModule } from '../supply-directory/supply-directory.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { AdminProjectsController } from './admin-projects.controller';
import { ProjectsController } from './projects.controller';
import { GuestProjectsController } from './guest-projects.controller';
import { PublicProjectsController } from './public-projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectReviewsService } from './project-reviews.service';
import { ProjectScopeSyncService } from './project-scope-sync.service';
import { GuestProjectQuotaService } from './guest-project-quota.service';
import { GuestProjectCleanupService } from './guest-project-cleanup.service';

@Module({
  imports: [
    UsersModule,
    TagsModule,
    LocationsModule,
    EstimationModule,
    LocalizationModule,
    AiModule,
    SupplyDirectoryModule,
    NotificationsModule,
    forwardRef(() => IntakeModule),
    forwardRef(() => DocumentsModule),
  ],
  controllers: [
    AdminProjectsController,
    ProjectsController,
    GuestProjectsController,
    PublicProjectsController,
  ],
  providers: [
    ProjectsService,
    ProjectReviewsService,
    ProjectScopeSyncService,
    GuestProjectQuotaService,
    GuestProjectCleanupService,
  ],
  exports: [ProjectsService, ProjectReviewsService, ProjectScopeSyncService],
})
export class ProjectsModule {}
