import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PLATFORM_ADMIN_EMAIL } from './platform-fees';

const SETTINGS_ID = 'default';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export interface PlatformSettingsDto {
  contractSignedNotifyEmails: string[];
}

export interface UpdatePlatformSettingsDto {
  contractSignedNotifyEmails: string[];
}

@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getSettings(): Promise<PlatformSettingsDto> {
    const row = await this.ensureSettings();
    return {
      contractSignedNotifyEmails: row.contractSignedNotifyEmails,
    };
  }

  async updateSettings(
    body: UpdatePlatformSettingsDto,
  ): Promise<PlatformSettingsDto> {
    const emails = this.normalizeEmails(body.contractSignedNotifyEmails);
    const row = await this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        contractSignedNotifyEmails: emails,
      },
      update: {
        contractSignedNotifyEmails: emails,
      },
    });
    return {
      contractSignedNotifyEmails: row.contractSignedNotifyEmails,
    };
  }

  /**
   * Recipients for the fully-signed contract / platform-fee invoice email.
   * Uses DB list when non-empty; otherwise PLATFORM_ADMIN_EMAIL / default.
   */
  async resolveContractSignedNotifyEmails(): Promise<string[]> {
    const row = await this.ensureSettings();
    if (row.contractSignedNotifyEmails.length > 0) {
      return row.contractSignedNotifyEmails;
    }
    const fallback =
      this.config.get<string>('PLATFORM_ADMIN_EMAIL')?.trim() ||
      DEFAULT_PLATFORM_ADMIN_EMAIL;
    return fallback ? [fallback] : [];
  }

  private async ensureSettings() {
    const existing = await this.prisma.platformSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (existing) return existing;

    return this.prisma.platformSettings.create({
      data: {
        id: SETTINGS_ID,
        contractSignedNotifyEmails: [DEFAULT_PLATFORM_ADMIN_EMAIL],
      },
    });
  }

  private normalizeEmails(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
      throw new BadRequestException(
        'contractSignedNotifyEmails must be an array of email addresses',
      );
    }
    const seen = new Set<string>();
    const emails: string[] = [];
    for (const item of raw) {
      if (typeof item !== 'string') {
        throw new BadRequestException('Each email must be a string');
      }
      const email = item.trim().toLowerCase();
      if (!email) continue;
      if (!EMAIL_RE.test(email)) {
        throw new BadRequestException(`Invalid email: ${item.trim()}`);
      }
      if (seen.has(email)) continue;
      seen.add(email);
      emails.push(email);
    }
    return emails;
  }
}
