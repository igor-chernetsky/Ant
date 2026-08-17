import { Controller, Get } from '@nestjs/common';
import { AdsService } from './ads.service';

@Controller('v1/public/ads')
export class PublicAdsController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  list() {
    return this.ads.listPublic();
  }
}
