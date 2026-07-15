import { Global, Module } from '@nestjs/common';
import { ImageThumbnailService } from './image-thumbnail.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService, ImageThumbnailService],
  exports: [StorageService, ImageThumbnailService],
})
export class StorageModule {}
