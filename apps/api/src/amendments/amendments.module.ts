import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { EstimationModule } from '../estimation/estimation.module';
import { LocalizationModule } from '../localization/localization.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { AmendmentsController } from './amendments.controller';
import { AmendmentsService } from './amendments.service';

@Module({
  imports: [AiModule, EstimationModule, LocalizationModule, ProjectsModule, UsersModule],
  controllers: [AmendmentsController],
  providers: [AmendmentsService],
})
export class AmendmentsModule {}
