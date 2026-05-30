import { Module, forwardRef } from '@nestjs/common';

import { EstimationModule } from '../estimation/estimation.module';
import { IntakeModule } from '../intake/intake.module';

import { UsersModule } from '../users/users.module';

import { ProjectsController } from './projects.controller';

import { ProjectsService } from './projects.service';



@Module({

  imports: [UsersModule, EstimationModule, forwardRef(() => IntakeModule)],

  controllers: [ProjectsController],

  providers: [ProjectsService],

  exports: [ProjectsService],

})

export class ProjectsModule {}


