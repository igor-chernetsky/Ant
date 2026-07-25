import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupplyDirectoryEntry, SupplyDirectoryKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SupplyDirectoryEntryDto,
  UpsertDirectoryEntryDto,
} from './supply-directory.types';

@Injectable()
export class SupplyDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  toDto(entry: SupplyDirectoryEntry): SupplyDirectoryEntryDto {
    return {
      id: entry.id,
      kind: entry.kind,
      companyName: entry.companyName,
      contactName: entry.contactName,
      email: entry.email,
      phone: entry.phone,
      website: entry.website,
      regionSlug: entry.regionSlug,
      notes: entry.notes,
      isActive: entry.isActive,
      sortOrder: entry.sortOrder,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  async listAdmin(kind?: SupplyDirectoryKind): Promise<SupplyDirectoryEntryDto[]> {
    const entries = await this.prisma.supplyDirectoryEntry.findMany({
      where: kind ? { kind } : undefined,
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { companyName: 'asc' }],
    });
    return entries.map((e) => this.toDto(e));
  }

  async listActive(kind?: SupplyDirectoryKind): Promise<SupplyDirectoryEntryDto[]> {
    const entries = await this.prisma.supplyDirectoryEntry.findMany({
      where: {
        isActive: true,
        ...(kind ? { kind } : {}),
      },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { companyName: 'asc' }],
    });
    return entries.map((e) => this.toDto(e));
  }

  async getById(id: string): Promise<SupplyDirectoryEntryDto> {
    const entry = await this.prisma.supplyDirectoryEntry.findUnique({
      where: { id },
    });
    if (!entry) {
      throw new NotFoundException('Directory entry not found');
    }
    return this.toDto(entry);
  }

  async create(dto: UpsertDirectoryEntryDto): Promise<SupplyDirectoryEntryDto> {
    const data = this.normalizeUpsert(dto);
    const entry = await this.prisma.supplyDirectoryEntry.create({ data });
    return this.toDto(entry);
  }

  async update(
    id: string,
    dto: UpsertDirectoryEntryDto,
  ): Promise<SupplyDirectoryEntryDto> {
    const existing = await this.prisma.supplyDirectoryEntry.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Directory entry not found');
    }
    const data = this.normalizeUpsert(dto);
    const entry = await this.prisma.supplyDirectoryEntry.update({
      where: { id },
      data,
    });
    return this.toDto(entry);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.supplyDirectoryEntry.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Directory entry not found');
    }
    await this.prisma.supplyDirectoryEntry.delete({ where: { id } });
  }

  private normalizeUpsert(dto: UpsertDirectoryEntryDto) {
    const companyName = dto.companyName?.trim();
    const email = dto.email?.trim().toLowerCase();
    if (!companyName) {
      throw new BadRequestException('companyName is required');
    }
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    if (!Object.values(SupplyDirectoryKind).includes(dto.kind)) {
      throw new BadRequestException('Invalid directory kind');
    }

    return {
      kind: dto.kind,
      companyName,
      contactName: dto.contactName?.trim() || null,
      email,
      phone: dto.phone?.trim() || null,
      website: dto.website?.trim() || null,
      regionSlug: dto.regionSlug?.trim() || null,
      notes: dto.notes?.trim() || null,
      isActive: dto.isActive ?? true,
      sortOrder: Number.isFinite(dto.sortOrder) ? Number(dto.sortOrder) : 0,
    };
  }
}
