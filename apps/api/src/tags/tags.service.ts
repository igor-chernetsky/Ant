import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugifyTagLabel } from '../projects/project-brief';
import { CreateTagDto, TagCatalogItem } from '../projects/projects.types';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  private toCatalogItem(tag: {
    slug: string;
    label: string;
    isSystem: boolean;
    group: { slug: string; label: string } | null;
  }): TagCatalogItem {
    return {
      slug: tag.slug,
      label: tag.label,
      groupSlug: tag.group?.slug ?? null,
      groupLabel: tag.group?.label ?? null,
      isSystem: tag.isSystem,
    };
  }

  async listCatalog(): Promise<TagCatalogItem[]> {
    const tags = await this.prisma.tag.findMany({
      include: { group: true },
      orderBy: [{ group: { sortOrder: 'asc' } }, { label: 'asc' }],
    });
    return tags.map((tag) => this.toCatalogItem(tag));
  }

  async createCustom(dto: CreateTagDto): Promise<TagCatalogItem> {
    const label = dto.label.trim();
    if (label.length < 2) {
      throw new BadRequestException('Tag label must be at least 2 characters');
    }

    const slug = slugifyTagLabel(label);
    if (!slug) {
      throw new BadRequestException('Invalid tag label');
    }

    const existing = await this.prisma.tag.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Tag "${existing.label}" already exists`);
    }

    let groupId: string | undefined;
    if (dto.groupSlug?.trim()) {
      const group = await this.prisma.tagGroup.findUnique({
        where: { slug: dto.groupSlug.trim() },
      });
      if (!group) {
        throw new BadRequestException(`Unknown tag group: ${dto.groupSlug}`);
      }
      groupId = group.id;
    }

    const tag = await this.prisma.tag.create({
      data: {
        slug,
        label,
        isSystem: false,
        groupId,
      },
      include: { group: true },
    });

    return this.toCatalogItem(tag);
  }
}
