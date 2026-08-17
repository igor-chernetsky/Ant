import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  HomeAdSlideDto,
  PublicHomeAdSlideDto,
  UpsertHomeAdSlideDto,
} from './ads.types';
import type { HomeAdSlide } from '@prisma/client';

const MAX_SLIDES = 12;

function requireText(value: string | undefined, field: string): string {
  const text = value?.trim() ?? '';
  if (!text) {
    throw new BadRequestException(`${field} is required`);
  }
  return text;
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
    const created = await this.prisma.homeAdSlide.create({
      data: {
        sortOrder: dto.sortOrder ?? (last?.sortOrder ?? -1) + 1,
        enabled: dto.enabled ?? true,
        href: requireText(dto.href, 'href'),
        imageUrl: requireText(dto.imageUrl, 'imageUrl'),
        titleEn: requireText(dto.title?.en, 'title.en'),
        titleRu: requireText(dto.title?.ru, 'title.ru'),
        titleTh: requireText(dto.title?.th, 'title.th'),
        descriptionEn: requireText(dto.description?.en, 'description.en'),
        descriptionRu: requireText(dto.description?.ru, 'description.ru'),
        descriptionTh: requireText(dto.description?.th, 'description.th'),
        ctaEn: requireText(dto.ctaLabel?.en, 'ctaLabel.en'),
        ctaRu: requireText(dto.ctaLabel?.ru, 'ctaLabel.ru'),
        ctaTh: requireText(dto.ctaLabel?.th, 'ctaLabel.th'),
      },
    });
    return this.toAdminDto(created);
  }

  async update(
    id: string,
    dto: UpsertHomeAdSlideDto,
  ): Promise<HomeAdSlideDto> {
    await this.requireSlide(id);
    const updated = await this.prisma.homeAdSlide.update({
      where: { id },
      data: {
        sortOrder: dto.sortOrder,
        enabled: dto.enabled,
        href: dto.href?.trim(),
        imageUrl: dto.imageUrl?.trim(),
        titleEn: dto.title?.en?.trim(),
        titleRu: dto.title?.ru?.trim(),
        titleTh: dto.title?.th?.trim(),
        descriptionEn: dto.description?.en?.trim(),
        descriptionRu: dto.description?.ru?.trim(),
        descriptionTh: dto.description?.th?.trim(),
        ctaEn: dto.ctaLabel?.en?.trim(),
        ctaRu: dto.ctaLabel?.ru?.trim(),
        ctaTh: dto.ctaLabel?.th?.trim(),
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
      href: slide.href,
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
      href: admin.href,
      imageUrl: admin.imageUrl,
      title: admin.title,
      description: admin.description,
      ctaLabel: admin.ctaLabel,
    };
  }
}
