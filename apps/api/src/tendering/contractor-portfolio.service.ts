import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ContractorVerificationStatus,
  DocumentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import { ImageThumbnailService } from '../storage/image-thumbnail.service';
import {
  ALLOWED_PORTFOLIO_CONTENT_TYPES,
  buildPortfolioStorageKey,
  buildPortfolioThumbnailKey,
  MAX_PORTFOLIO_ITEMS,
  MAX_PORTFOLIO_UPLOAD_BYTES,
  PortfolioItemResponse,
  PresignPortfolioItemDto,
  UpdatePortfolioItemDto,
} from './portfolio.types';

@Injectable()
export class ContractorPortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly thumbnails: ImageThumbnailService,
  ) {}

  private toBaseResponse(item: {
    id: string;
    contractorId: string;
    title: string;
    description: string | null;
    originalName: string;
    contentType: string;
    sizeBytes: number | null;
    status: DocumentStatus;
    sortOrder: number;
    createdAt: Date;
    uploadedAt: Date | null;
    thumbnailStorageKey: string | null;
  }): PortfolioItemResponse {
    return {
      id: item.id,
      contractorId: item.contractorId,
      title: item.title,
      description: item.description,
      originalName: item.originalName,
      contentType: item.contentType,
      sizeBytes: item.sizeBytes,
      status: item.status,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
      uploadedAt: item.uploadedAt?.toISOString() ?? null,
      hasThumbnail: Boolean(item.thumbnailStorageKey),
    };
  }

  private async attachImageUrls(
    items: PortfolioItemResponse[],
    records: Array<{
      id: string;
      storageKey: string;
      thumbnailStorageKey: string | null;
      status: DocumentStatus;
    }>,
  ): Promise<PortfolioItemResponse[]> {
    if (!this.storage.isConfigured()) {
      return items;
    }

    const recordById = new Map(records.map((r) => [r.id, r]));
    return Promise.all(
      items.map(async (item) => {
        const record = recordById.get(item.id);
        if (!record || record.status !== DocumentStatus.uploaded) {
          return item;
        }

        const [imageUrl, thumbnailUrl] = await Promise.all([
          this.storage.createPresignedDownload(record.storageKey),
          record.thumbnailStorageKey
            ? this.storage.createPresignedDownload(record.thumbnailStorageKey)
            : Promise.resolve(null),
        ]);

        return {
          ...item,
          imageUrl: imageUrl.downloadUrl,
          thumbnailUrl: thumbnailUrl?.downloadUrl,
        };
      }),
    );
  }

  async listForContractor(userId: string): Promise<PortfolioItemResponse[]> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const items = await this.prisma.contractorPortfolioItem.findMany({
      where: {
        contractorId: profile.id,
        status: { not: DocumentStatus.deleted },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const base = items.map((item) => this.toBaseResponse(item));
    return this.attachImageUrls(base, items);
  }

  async listPublic(contractorId: string): Promise<PortfolioItemResponse[]> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { id: contractorId },
    });
    if (
      !profile ||
      profile.verificationStatus !== ContractorVerificationStatus.verified
    ) {
      throw new NotFoundException('Contractor not found');
    }

    const items = await this.prisma.contractorPortfolioItem.findMany({
      where: {
        contractorId,
        status: DocumentStatus.uploaded,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const base = items.map((item) => this.toBaseResponse(item));
    return this.attachImageUrls(base, items);
  }

  async presignUpload(userId: string, dto: PresignPortfolioItemDto) {
    const profile = await this.contractorProfiles.requireByUserId(userId);

    const title = dto.title?.trim() ?? '';

    const fileName = dto.fileName?.trim();
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }

    const contentType = dto.contentType?.trim().toLowerCase();
    if (!contentType || !ALLOWED_PORTFOLIO_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException(
        'Unsupported content type. Use JPEG, PNG, or WebP images.',
      );
    }

    if (
      !Number.isFinite(dto.sizeBytes) ||
      dto.sizeBytes < 1 ||
      dto.sizeBytes > MAX_PORTFOLIO_UPLOAD_BYTES
    ) {
      throw new BadRequestException('Invalid file size');
    }

    const activeCount = await this.prisma.contractorPortfolioItem.count({
      where: {
        contractorId: profile.id,
        status: { not: DocumentStatus.deleted },
      },
    });
    if (activeCount >= MAX_PORTFOLIO_ITEMS) {
      throw new BadRequestException(
        `Portfolio limit reached (${MAX_PORTFOLIO_ITEMS} items)`,
      );
    }

    const maxSort = await this.prisma.contractorPortfolioItem.aggregate({
      where: {
        contractorId: profile.id,
        status: { not: DocumentStatus.deleted },
      },
      _max: { sortOrder: true },
    });

    const itemId = randomUUID();
    const storageKey = buildPortfolioStorageKey(
      profile.id,
      itemId,
      fileName,
    );

    await this.prisma.contractorPortfolioItem.create({
      data: {
        id: itemId,
        contractorId: profile.id,
        title,
        description: null,
        originalName: fileName,
        contentType,
        sizeBytes: dto.sizeBytes,
        storageKey,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        status: DocumentStatus.pending,
      },
    });

    const presigned = await this.storage.createPresignedUpload({
      storageKey,
      contentType,
      sizeBytes: dto.sizeBytes,
    });

    return {
      itemId,
      uploadUrl: presigned.uploadUrl,
      storageKey: presigned.storageKey,
      expiresInSeconds: presigned.expiresInSeconds,
    };
  }

  async completeUpload(
    userId: string,
    itemId: string,
  ): Promise<PortfolioItemResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const item = await this.prisma.contractorPortfolioItem.findFirst({
      where: {
        id: itemId,
        contractorId: profile.id,
        status: { not: DocumentStatus.deleted },
      },
    });
    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }
    if (item.status === DocumentStatus.uploaded) {
      const [response] = await this.attachImageUrls(
        [this.toBaseResponse(item)],
        [item],
      );
      return response;
    }

    const { sizeBytes } = await this.storage.verifyObject(item.storageKey);
    const updated = await this.prisma.contractorPortfolioItem.update({
      where: { id: itemId },
      data: {
        status: DocumentStatus.uploaded,
        sizeBytes,
        uploadedAt: new Date(),
      },
    });

    void this.generateThumbnailInBackground(profile.id, updated);

    const [response] = await this.attachImageUrls(
      [this.toBaseResponse(updated)],
      [updated],
    );
    return response;
  }

  private generateThumbnailInBackground(
    contractorId: string,
    item: {
      id: string;
      storageKey: string;
      contentType: string;
      thumbnailStorageKey: string | null;
    },
  ): void {
    if (!this.storage.isConfigured()) {
      return;
    }

    void (async () => {
      try {
        const buffer = await this.storage.getObjectBuffer(item.storageKey);
        const thumbBuffer = await this.thumbnails.createJpegThumbnail(
          buffer,
          item.contentType,
        );
        if (!thumbBuffer) {
          return;
        }

        const thumbnailStorageKey = buildPortfolioThumbnailKey(
          contractorId,
          item.id,
        );
        await this.storage.putObject({
          storageKey: thumbnailStorageKey,
          body: thumbBuffer,
          contentType: 'image/jpeg',
        });

        await this.prisma.contractorPortfolioItem.update({
          where: { id: item.id },
          data: { thumbnailStorageKey },
        });
      } catch {
        // Thumbnail is optional — original image is still available.
      }
    })();
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdatePortfolioItemDto,
  ): Promise<PortfolioItemResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const item = await this.prisma.contractorPortfolioItem.findFirst({
      where: {
        id: itemId,
        contractorId: profile.id,
        status: DocumentStatus.uploaded,
      },
    });
    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }

    const updated = await this.prisma.contractorPortfolioItem.update({
      where: { id: itemId },
      data:
        dto.title !== undefined
          ? { title: dto.title.trim() }
          : {},
    });

    const [response] = await this.attachImageUrls(
      [this.toBaseResponse(updated)],
      [updated],
    );
    return response;
  }

  async deleteItem(userId: string, itemId: string): Promise<void> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const item = await this.prisma.contractorPortfolioItem.findFirst({
      where: {
        id: itemId,
        contractorId: profile.id,
        status: { not: DocumentStatus.deleted },
      },
    });
    if (!item) {
      throw new NotFoundException('Portfolio item not found');
    }

    if (this.storage.isConfigured()) {
      const keys = [item.storageKey, item.thumbnailStorageKey].filter(
        (key): key is string => Boolean(key),
      );
      for (const key of keys) {
        try {
          await this.storage.deleteObject(key);
        } catch {
          // best-effort
        }
      }
    }

    await this.prisma.contractorPortfolioItem.update({
      where: { id: itemId },
      data: { status: DocumentStatus.deleted },
    });
  }
}
