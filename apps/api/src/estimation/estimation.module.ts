import { Module } from '@nestjs/common';
import { LocalizationModule } from '../localization/localization.module';
import { UsersModule } from '../users/users.module';
import { BallparkEstimateService } from './ballpark-estimate.service';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';

@Module({
  imports: [UsersModule, LocalizationModule],
  controllers: [EstimatesController],
  providers: [BallparkEstimateService, EstimatesService],
  exports: [EstimatesService],
})
export class EstimationModule {}
