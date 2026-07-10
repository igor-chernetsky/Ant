import { Module, forwardRef } from '@nestjs/common';

import { EstimationModule } from '../estimation/estimation.module';
import { IntakeModule } from '../intake/intake.module';
import { LocalizationModule } from '../localization/localization.module';
import { LocationsModule } from '../locations/locations.module';
import { TagsModule } from '../tags/tags.module';
import { UsersModule } from '../users/users.module';

import { ProjectsController } from './projects.controller';
import { PublicProjectsController } from './public-projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectReviewsService } from './project-reviews.service';

@Module({
  imports: [UsersModule, TagsModule, LocationsModule, EstimationModule, LocalizationModule, forwardRef(() => IntakeModule)],
  controllers: [ProjectsController, PublicProjectsController],
  providers: [ProjectsService, ProjectReviewsService],
  exports: [ProjectsService, ProjectReviewsService],
})
export class ProjectsModule {}
