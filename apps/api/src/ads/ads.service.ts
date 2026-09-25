import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { sanitizeFileName } from '../documents/documents.types';
import type {
  HomeAdImageSource,
  HomeAdSlideDto,
  HomeAdSlideTemplate,
  PresignAdImageDto,
  PublicHomeAdSlideDto,
  UpsertHomeAdSlideDto,
} from './ads.types';
import {
  HomeAdSlideTemplate as PrismaHomeAdSlideTemplate,
  type HomeAdSlide,
} from '@prisma/client';

const MAX_SLIDES = 12;

/**
 * Promo images are displayed by the browser, so only formats every browser can
 * decode are accepted (no HEIC/HEIF, unlike the contractor portfolio which
 * generates thumbnails).
 */
const ALLOWED_AD_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const MAX_AD_IMAGE_BYTES = 8 * 1024 * 1024;
const AD_IMAGE_KEY_PREFIX = 'ads/';

function requireText(value: string | undefined, field: string): string {
  const text = value?.trim() ?? '';
  if (!text) {
    throw new BadRequestException(`${field} is required`);
  }
  return text;
}

/**
 * Relative path (`/materials`) or absolute http(s) URL.
 *
 * These values end up in `href` / `src` attributes, so `javascript:` and other
 * exotic schemes must not get through even though only admins can type them.
 */
function requireAssetUrl(value: string | undefined, field: string): string {
  const text = requireText(value, field);
  if (text.startsWith('/') && !text.startsWith('//')) {
    return text;
  }
  if (/^https?:\/\//i.test(text)) {
    return text;
  }
  throw new BadRequestException(
    `${field} must be a path starting with "/" or an http(s) URL`,
  );
}

/** Same rules as {@link requireAssetUrl}, but an empty value means "no link". */
function optionalAssetUrl(
  value: string | null | undefined,
  field: string,
): string | null {
  const text = value?.trim() ?? '';
  if (!text) {
    return null;
  }
  return requireAssetUrl(text, field);
}

export function normalizeTemplate(
  value: string | null | undefined,
): HomeAdSlideTemplate {
  return value === PrismaHomeAdSlideTemplate.image ? 'image' : 'card';
}

function buildAdImageStorageKey(fileName: string): string {
  return `${AD_IMAGE_KEY_PREFIX}${randomUUID()}/${sanitizeFileName(fileName)}`;
}

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listPublic(): Promise<PublicHomeAdSlideDto[]> {
    const slides = await this.prisma.homeAdSlide.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
    return slides.map((slide) => this.toPublicDto(slide));
  }

  async listAdmin(): Promise<HomeAdSlideDto[]> {
    const slides = await this.prisma.homeAdSlide.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return slides.map((slide) => this.toAdminDto(slide));
  }

  /**
   * Upload URL for a slide image. Not tied to a slide id, so the file can be
   * uploaded before the slide exists; the returned key is verified when the
   * slide is created or updated.
   */
  async presignImage(dto: PresignAdImageDto): Promise<{
    uploadUrl: string;
    storageKey: string;
    expiresInSeconds: number;
  }> {
    const fileName = dto.fileName?.trim();
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }

    const contentType = dto.contentType?.trim().toLowerCase();
    if (!contentType || !ALLOWED_AD_IMAGE_TYPES.has(contentType)) {
      throw new BadRequestException(
        'Unsupported image type. Use JPEG, PNG, WebP, or AVIF.',
      );
    }

    if (
      !Number.isFinite(dto.sizeBytes) ||
      (dto.sizeBytes ?? 0) < 1 ||
      (dto.sizeBytes ?? 0) > MAX_AD_IMAGE_BYTES
    ) {
      throw new BadRequestException(
        `Image must be smaller than ${MAX_AD_IMAGE_BYTES / (1024 * 1024)} MB`,
      );
    }

    const storageKey = buildAdImageStorageKey(fileName);
    const presigned = await this.storage.createPresignedUpload({
      storageKey,
      contentType,
      sizeBytes: dto.sizeBytes as number,
    });

    return {
      uploadUrl: presigned.uploadUrl,
      storageKey: presigned.storageKey,
      expiresInSeconds: presigned.expiresInSeconds,
    };
  }

  /** Resolves the stable URL a browser should use for an uploaded slide image. */
  async getPublicImageDownloadUrl(slideId: string): Promise<{
    downloadUrl: string;
    expiresInSeconds: number;
  }> {
    const slide = await this.prisma.homeAdSlide.findUnique({
      where: { id: slideId },
      select: { imageStorageKey: true },
    });
    if (!slide?.imageStorageKey) {
      throw new NotFoundException('Slide image not found');
    }
    return this.storage.createPresignedDownload(slide.imageStorageKey);
  }

  async create(dto: UpsertHomeAdSlideDto): Promise<HomeAdSlideDto> {
    const count = await this.prisma.homeAdSlide.count();
    if (count >= MAX_SLIDES) {
      throw new BadRequestException(`At most ${MAX_SLIDES} slides are allowed`);
    }
    const last = await this.prisma.homeAdSlide.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const template = normalizeTemplate(dto.template);
    const image = await this.resolveNewImage(dto);
    const copy =
      template === 'card'
        ? {
            href: requireAssetUrl(dto.href ?? undefined, 'href'),
            titleEn: requireText(dto.title?.en, 'title.en'),
            titleRu: requireText(dto.title?.ru, 'title.ru'),
            titleTh: requireText(dto.title?.th, 'title.th'),
            descriptionEn: requireText(dto.description?.en, 'description.en'),
            descriptionRu: requireText(dto.description?.ru, 'description.ru'),
            descriptionTh: requireText(dto.description?.th, 'description.th'),
            ctaEn: requireText(dto.ctaLabel?.en, 'ctaLabel.en'),
            ctaRu: requireText(dto.ctaLabel?.ru, 'ctaLabel.ru'),
            ctaTh: requireText(dto.ctaLabel?.th, 'ctaLabel.th'),
          }
        : {
            href: optionalAssetUrl(dto.href, 'href'),
            // An image slide carries no copy; the columns stay NOT NULL.
            titleEn: '',
            titleRu: '',
            titleTh: '',
            descriptionEn: '',
            descriptionRu: '',
            descriptionTh: '',
            ctaEn: '',
            ctaRu: '',
            ctaTh: '',
          };

    const created = await this.prisma.homeAdSlide.create({
      data: {
        sortOrder: dto.sortOrder ?? (last?.sortOrder ?? -1) + 1,
        enabled: dto.enabled ?? true,
        template,
        ...image,
        ...copy,
      },
    });
    return this.toAdminDto(created);
  }

  async update(
    id: string,
    dto: UpsertHomeAdSlideDto,
  ): Promise<HomeAdSlideDto> {
    const existing = await this.requireSlide(id);
    const template =
      dto.template === undefined
        ? normalizeTemplate(existing.template)
        : normalizeTemplate(dto.template);

    const image = await this.resolveUpdatedImage(existing, dto);

    // For `image` the copy columns are left untouched rather than cleared, so
    // switching back to `card` still has the text the admin wrote earlier.
    const payload =
      template === 'card'
        ? {
            template: PrismaHomeAdSlideTemplate.card,
            href: requireAssetUrl(dto.href ?? existing.href ?? undefined, 'href'),
            titleEn: requireText(dto.title?.en ?? existing.titleEn, 'title.en'),
            titleRu: requireText(dto.title?.ru ?? existing.titleRu, 'title.ru'),
            titleTh: requireText(dto.title?.th ?? existing.titleTh, 'title.th'),
            descriptionEn: requireText(
              dto.description?.en ?? existing.descriptionEn,
              'description.en',
            ),
            descriptionRu: requireText(
              dto.description?.ru ?? existing.descriptionRu,
              'description.ru',
            ),
            descriptionTh: requireText(
              dto.description?.th ?? existing.descriptionTh,
              'description.th',
            ),
            ctaEn: requireText(dto.ctaLabel?.en ?? existing.ctaEn, 'ctaLabel.en'),
            ctaRu: requireText(dto.ctaLabel?.ru ?? existing.ctaRu, 'ctaLabel.ru'),
            ctaTh: requireText(dto.ctaLabel?.th ?? existing.ctaTh, 'ctaLabel.th'),
          }
        : {
            template: PrismaHomeAdSlideTemplate.image,
            href:
              dto.href === undefined
                ? existing.href
                : optionalAssetUrl(dto.href, 'href'),
          };

    const updated = await this.prisma.homeAdSlide.update({
      where: { id },
      data: {
        sortOrder: dto.sortOrder,
        enabled: dto.enabled,
        ...image,
        ...payload,
      },
    });

    // The row now points elsewhere: drop the replaced object (best effort, after
    // the write so a failure cannot lose the current image).
    const previousKey = existing.imageStorageKey;
    if (previousKey && previousKey !== updated.imageStorageKey) {
      await this.deleteObjectQuietly(previousKey);
    }

    return this.toAdminDto(updated);
  }

  async remove(id: string): Promise<void> {
    const slide = await this.requireSlide(id);
    await this.prisma.homeAdSlide.delete({ where: { id } });
    if (slide.imageStorageKey) {
      await this.deleteObjectQuietly(slide.imageStorageKey);
    }
  }

  private async requireSlide(id: string) {
    const slide = await this.prisma.homeAdSlide.findUnique({ where: { id } });
    if (!slide) {
      throw new NotFoundException('Ad slide not found');
    }
    return slide;
  }

  /**
   * Which of `imageUrl` / `imageStorageKey` the slide should use.
   *
   * Returns an empty object when the caller did not touch the image, so partial
   * updates (reordering sends only `sortOrder`) leave it alone.
   */
  private async resolveUpdatedImage(
    existing: HomeAdSlide,
    dto: UpsertHomeAdSlideDto,
  ): Promise<{ imageUrl?: string | null; imageStorageKey?: string | null }> {
    const source = this.imageSource(dto);
    if (!source) {
      return {};
    }

    if (source === 'upload') {
      const key = await this.requireUploadedImageKey(dto.imageStorageKey);
      if (!key) {
        throw new BadRequestException(
          'Upload an image or provide an image URL',
        );
      }
      return { imageUrl: null, imageStorageKey: key };
    }

    return {
      imageUrl: requireAssetUrl(dto.imageUrl ?? undefined, 'imageUrl'),
      imageStorageKey: null,
    };
  }

  private async resolveNewImage(
    dto: UpsertHomeAdSlideDto,
  ): Promise<{ imageUrl: string | null; imageStorageKey: string | null }> {
    const source = this.imageSource(dto) ?? 'url';

    if (source === 'upload') {
      const key = await this.requireUploadedImageKey(dto.imageStorageKey);
      if (!key) {
        throw new BadRequestException(
          'Upload an image or provide an image URL',
        );
      }
      return { imageUrl: null, imageStorageKey: key };
    }

    return {
      imageUrl: requireAssetUrl(dto.imageUrl ?? undefined, 'imageUrl'),
      imageStorageKey: null,
    };
  }

  private imageSource(
    dto: UpsertHomeAdSlideDto,
  ): HomeAdImageSource | null {
    if (dto.imageSource) {
      return dto.imageSource;
    }
    if (dto.imageStorageKey?.trim()) {
      return 'upload';
    }
    if (dto.imageUrl !== undefined) {
      return 'url';
    }
    return null;
  }

  /** Confirms the key belongs to this feature and the object really exists. */
  private async requireUploadedImageKey(
    value: string | undefined,
  ): Promise<string | null> {
    const key = value?.trim();
    if (!key) {
      return null;
    }
    if (!key.startsWith(AD_IMAGE_KEY_PREFIX)) {
      throw new BadRequestException('Invalid image key');
    }
    await this.storage.verifyObject(key);
    return key;
  }

  private async deleteObjectQuietly(storageKey: string): Promise<void> {
    try {
      await this.storage.deleteObject(storageKey);
    } catch {
      // Replacing an image must not fail because the old object is gone.
    }
  }

  private toAdminDto(slide: HomeAdSlide): HomeAdSlideDto {
    return {
      id: slide.id,
      sortOrder: slide.sortOrder,
      enabled: slide.enabled,
      template: normalizeTemplate(slide.template),
      href: slide.href?.trim() ? slide.href : null,
      imageUrl: slide.imageStorageKey ? null : slide.imageUrl,
      imageUploaded: Boolean(slide.imageStorageKey),
      title: {
        en: slide.titleEn,
        ru: slide.titleRu,
        th: slide.titleTh,
      },
      description: {
        en: slide.descriptionEn,
        ru: slide.descriptionRu,
        th: slide.descriptionTh,
      },
      ctaLabel: {
        en: slide.ctaEn,
        ru: slide.ctaRu,
        th: slide.ctaTh,
      },
    };
  }

  private toPublicDto(slide: HomeAdSlide): PublicHomeAdSlideDto {
    const admin = this.toAdminDto(slide);
    return {
      id: admin.id,
      template: admin.template,
      href: admin.href,
      imageUrl: admin.imageUrl,
      imageUploaded: admin.imageUploaded,
      title: admin.title,
      description: admin.description,
      ctaLabel: admin.ctaLabel,
    };
  }
}
