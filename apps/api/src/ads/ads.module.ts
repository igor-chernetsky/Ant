import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAdsController } from './admin-ads.controller';
import { PublicAdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [AuthModule],
  controllers: [PublicAdsController, AdminAdsController],
  providers: [AdsService],
})
export class AdsModule {}
