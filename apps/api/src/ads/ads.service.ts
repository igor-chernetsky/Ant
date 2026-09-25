import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  HomeAdSlideDto,
  HomeAdSlideTemplate,
  PublicHomeAdSlideDto,
  UpsertHomeAdSlideDto,
} from './ads.types';
import {
  HomeAdSlideTemplate as PrismaHomeAdSlideTemplate,
  type HomeAdSlide,
} from '@prisma/client';

const MAX_SLIDES = 12;

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

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const imageUrl = requireAssetUrl(dto.imageUrl, 'imageUrl');
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
        imageUrl,
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

    const imageUrl = requireAssetUrl(
      dto.imageUrl ?? existing.imageUrl,
      'imageUrl',
    );

    // For `image` the copy columns are left untouched rather than cleared, so
    // switching back to `card` still has the text the admin wrote earlier.
    const payload =
      template === 'card'
        ? {
            template: PrismaHomeAdSlideTemplate.card,
            imageUrl,
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
            imageUrl,
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
        ...payload,
      },
    });
    return this.toAdminDto(updated);
  }

  async remove(id: string): Promise<void> {
    await this.requireSlide(id);
    await this.prisma.homeAdSlide.delete({ where: { id } });
  }

  private async requireSlide(id: string) {
    const slide = await this.prisma.homeAdSlide.findUnique({ where: { id } });
    if (!slide) {
      throw new NotFoundException('Ad slide not found');
    }
    return slide;
  }

  private toAdminDto(slide: HomeAdSlide): HomeAdSlideDto {
    return {
      id: slide.id,
      sortOrder: slide.sortOrder,
      enabled: slide.enabled,
      template: normalizeTemplate(slide.template),
      href: slide.href?.trim() ? slide.href : null,
      imageUrl: slide.imageUrl,
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
      title: admin.title,
      description: admin.description,
      ctaLabel: admin.ctaLabel,
    };
  }
}
