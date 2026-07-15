import { Module, forwardRef } from '@nestjs/common';

import { EstimationModule } from '../estimation/estimation.module';
import { AiModule } from '../ai/ai.module';
import { IntakeModule } from '../intake/intake.module';
import { LocalizationModule } from '../localization/localization.module';
import { LocationsModule } from '../locations/locations.module';
import { TagsModule } from '../tags/tags.module';
import { UsersModule } from '../users/users.module';
import { DocumentsModule } from '../documents/documents.module';

import { ProjectsController } from './projects.controller';
import { PublicProjectsController } from './public-projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectReviewsService } from './project-reviews.service';
import { ProjectScopeSyncService } from './project-scope-sync.service';

@Module({
  imports: [
    UsersModule,
    TagsModule,
    LocationsModule,
    EstimationModule,
    LocalizationModule,
    AiModule,
    forwardRef(() => IntakeModule),
    forwardRef(() => DocumentsModule),
  ],
  controllers: [ProjectsController, PublicProjectsController],
  providers: [ProjectsService, ProjectReviewsService, ProjectScopeSyncService],
  exports: [ProjectsService, ProjectReviewsService, ProjectScopeSyncService],
})
export class ProjectsModule {}
