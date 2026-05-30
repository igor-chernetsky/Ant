import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { EstimationModule } from '../estimation/estimation.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';

@Module({
  imports: [
    AiModule,
    EstimationModule,
    UsersModule,
    forwardRef(() => ProjectsModule),
  ],
  controllers: [IntakeController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
