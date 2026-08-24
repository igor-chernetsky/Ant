import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { DEFAULT_PLATFORM_ADMIN_EMAIL } from './platform-fees';

const SETTINGS_ID = 'default';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DEFAULT_BROADCAST_FROM = 'hello@builthai.com';
const MAX_SUBJECT_LEN = 200;
const MAX_HTML_LEN = 100_000;

export interface PlatformSettingsDto {
  contractSignedNotifyEmails: string[];
}

export interface UpdatePlatformSettingsDto {
  contractSignedNotifyEmails: string[];
}

export interface SendAdminBroadcastDto {
  to: string;
  subject: string;
  html: string;
}

export interface SendAdminBroadcastResult {
  sent: true;
  from: string;
}

@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
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

  /**
   * One-off admin email from hello@ (SMTP_BROADCAST_FROM).
   * System notifications keep using SMTP_FROM (noreply@).
   */
  async sendAdminBroadcast(
    body: SendAdminBroadcastDto,
  ): Promise<SendAdminBroadcastResult> {
    if (!this.mail.isConfigured()) {
      throw new ServiceUnavailableException('SMTP is not configured');
    }

    const to = this.normalizeSingleEmail(body.to, 'to');
    const subject = this.normalizeSubject(body.subject);
    const html = this.normalizeBroadcastHtml(body.html);
    const text = htmlToPlainText(html);

    const from =
      this.config.get<string>('SMTP_BROADCAST_FROM')?.trim() ||
      DEFAULT_BROADCAST_FROM;
    const fromName =
      this.config.get<string>('SMTP_BROADCAST_FROM_NAME')?.trim() ||
      this.config.get<string>('SMTP_FROM_NAME')?.trim() ||
      'BuilTHAI';

    const sent = await this.mail.send({
      to,
      subject,
      html,
      text,
      from,
      fromName,
      replyTo: from,
    });
    if (!sent) {
      throw new ServiceUnavailableException('Failed to send email');
    }
    return { sent: true, from };
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

  private normalizeSingleEmail(raw: unknown, field: string): string {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    const email = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new BadRequestException(`Invalid email: ${raw.trim()}`);
    }
    return email;
  }

  private normalizeSubject(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new BadRequestException('subject is required');
    }
    const subject = raw.trim().replace(/\s+/g, ' ');
    if (subject.length > MAX_SUBJECT_LEN) {
      throw new BadRequestException(
        `subject must be at most ${MAX_SUBJECT_LEN} characters`,
      );
    }
    return subject;
  }

  private normalizeBroadcastHtml(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new BadRequestException('html is required');
    }
    if (raw.length > MAX_HTML_LEN) {
      throw new BadRequestException('Message body is too large');
    }
    const html = sanitizeBroadcastHtml(raw);
    if (!htmlToPlainText(html).trim()) {
      throw new BadRequestException('Message body is empty');
    }
    return html;
  }
}

function sanitizeBroadcastHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|link|meta)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1="#"')
    .trim();
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/(div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
