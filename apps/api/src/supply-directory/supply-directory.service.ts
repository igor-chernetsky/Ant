import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplyDirectoryEntry, SupplyDirectoryKind } from '@prisma/client';
import { LocationsService } from '../locations/locations.service';
import type { ServiceLocation } from '../locations/locations.catalog';
import { PrismaService } from '../prisma/prisma.service';
import {
  DirectoryListFilter,
  SupplyDirectoryEntryDto,
  UpsertDirectoryEntryDto,
} from './supply-directory.types';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class SupplyDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
  ) {}

  toDto(entry: SupplyDirectoryEntry): SupplyDirectoryEntryDto {
    return {
      id: entry.id,
      kind: entry.kind,
      companyName: entry.companyName,
      contactName: entry.contactName,
      email: entry.email,
      phone: entry.phone,
      website: entry.website,
      serviceLocations: this.parseServiceLocations(entry.serviceLocationsJson),
      tagSlugs: entry.tagSlugs ?? [],
      notes: entry.notes,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  parseServiceLocations(raw: unknown): ServiceLocation[] {
    return this.locations.coerceServiceLocations(raw);
  }

  async listAdmin(kind?: SupplyDirectoryKind): Promise<SupplyDirectoryEntryDto[]> {
    const entries = await this.prisma.supplyDirectoryEntry.findMany({
      where: kind ? { kind } : undefined,
      orderBy: [{ kind: 'asc' }, { companyName: 'asc' }],
    });
    return entries.map((e) => this.toDto(e));
  }

  async listForInvite(filter: DirectoryListFilter = {}): Promise<SupplyDirectoryEntryDto[]> {
    const entries = await this.prisma.supplyDirectoryEntry.findMany({
      where: filter.kind ? { kind: filter.kind } : undefined,
      orderBy: [{ kind: 'asc' }, { companyName: 'asc' }],
    });

    let dtos = entries.map((e) => this.toDto(e));

    if (filter.excludeRegistered && dtos.length > 0) {
      const emails = dtos.map((e) => e.email.trim().toLowerCase());
      const registeredUsers = await this.prisma.user.findMany({
        where: {
          email: { in: emails, mode: 'insensitive' },
          contractorProfile: { isNot: null },
        },
        select: { email: true },
      });
      const registered = new Set(
        registeredUsers
          .map((u) => u.email?.trim().toLowerCase())
          .filter((e): e is string => Boolean(e)),
      );
      dtos = dtos.filter((e) => !registered.has(e.email.trim().toLowerCase()));
    }

    const regionSlug = filter.locationRegionSlug?.trim();
    if (regionSlug) {
      const projectLocation = {
        regionSlug,
        areaSlug: filter.locationAreaSlug?.trim() || null,
      };
      dtos = dtos.filter((entry) =>
        this.matchesProjectLocation(entry.serviceLocations, projectLocation),
      );
    }

    const projectTags = (filter.tagSlugs ?? [])
      .map((slug) => slug.trim())
      .filter(Boolean);
    if (projectTags.length > 0) {
      dtos = dtos.filter((entry) =>
        this.matchesProjectTrades(entry.tagSlugs, projectTags),
      );
    }

    return dtos;
  }

  /** Empty locations = nationwide / any project. */
  matchesProjectLocation(
    serviceLocations: ServiceLocation[],
    project: { regionSlug: string; areaSlug?: string | null },
  ): boolean {
    if (serviceLocations.length === 0) {
      return true;
    }
    return this.locations.contractorMatchesProject(serviceLocations, project);
  }

  /** Empty entry tags = any trades; otherwise any overlap with project trades. */
  matchesProjectTrades(
    entryTagSlugs: string[],
    projectTagSlugs: string[],
  ): boolean {
    if (entryTagSlugs.length === 0 || projectTagSlugs.length === 0) {
      return true;
    }
    const entry = new Set(entryTagSlugs);
    return projectTagSlugs.some((slug) => entry.has(slug));
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
    await this.assertEmailAvailable(data.email, null);
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
    await this.assertEmailAvailable(data.email, id);
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

  /**
   * Drop registry rows for an email once the person has a BuilTHAI account
   * (they get matching-project mail instead of invite-from-registry).
   */
  async removeByEmail(email: string | null | undefined): Promise<number> {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      return 0;
    }
    const result = await this.prisma.supplyDirectoryEntry.deleteMany({
      where: { email: { equals: normalized, mode: 'insensitive' } },
    });
    return result.count;
  }

  private async assertEmailAvailable(
    email: string,
    excludeEntryId: string | null,
  ): Promise<void> {
    const duplicate = await this.prisma.supplyDirectoryEntry.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'This email is already in the supply registry',
      );
    }

    const registered = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (registered) {
      throw new ConflictException(
        'This email already belongs to a registered user',
      );
    }
  }

  private normalizeUpsert(
    dto: UpsertDirectoryEntryDto,
  ): Prisma.SupplyDirectoryEntryCreateInput {
    const companyName = dto.companyName?.trim();
    const email = dto.email ? normalizeEmail(dto.email) : '';
    if (!companyName) {
      throw new BadRequestException('companyName is required');
    }
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    if (!Object.values(SupplyDirectoryKind).includes(dto.kind)) {
      throw new BadRequestException('Invalid directory kind');
    }

    const serviceLocations =
      dto.serviceLocations == null ||
      (Array.isArray(dto.serviceLocations) && dto.serviceLocations.length === 0)
        ? []
        : this.locations.normalizeServiceLocations(dto.serviceLocations);

    const tagSlugs = [
      ...new Set(
        (dto.tagSlugs ?? [])
          .map((slug) => String(slug).trim())
          .filter(Boolean),
      ),
    ];

    return {
      kind: dto.kind,
      companyName,
      contactName: dto.contactName?.trim() || null,
      email,
      phone: dto.phone?.trim() || null,
      website: dto.website?.trim() || null,
      serviceLocationsJson: serviceLocations as unknown as Prisma.InputJsonValue,
      tagSlugs,
      notes: dto.notes?.trim() || null,
    };
  }
}
