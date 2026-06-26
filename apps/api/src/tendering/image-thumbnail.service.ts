import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

const THUMB_MAX_WIDTH = 480;
const THUMB_JPEG_QUALITY = 82;

@Injectable()
export class ImageThumbnailService {
  private readonly logger = new Logger(ImageThumbnailService.name);

  async createJpegThumbnail(
    source: Buffer,
    contentType: string,
  ): Promise<Buffer | null> {
    if (!contentType.startsWith('image/')) {
      return null;
    }

    try {
      return await sharp(source, { failOn: 'none' })
        .rotate()
        .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: THUMB_JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
    } catch (err) {
      this.logger.warn(
        `Thumbnail generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
