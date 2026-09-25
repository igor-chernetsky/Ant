import { Controller, Get, Param } from '@nestjs/common';
import { AdsService } from './ads.service';

@Controller('v1/public/ads')
export class PublicAdsController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  list() {
    return this.ads.listPublic();
  }

  /**
   * Stable image URL for an uploaded slide image: the web app points `<img>` at
   * its own `/api/public/ads/:id/image` route, which redirects here so the
   * browser always receives a fresh presigned link.
   */
  @Get(':id/image/download-url')
  getImageDownloadUrl(@Param('id') id: string) {
    return this.ads.getPublicImageDownloadUrl(id);
  }
}
