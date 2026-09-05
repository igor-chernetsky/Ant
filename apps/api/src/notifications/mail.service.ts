import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailOutboxStatus, Prisma } from '@prisma/client';
import nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';
import { PrismaService } from '../prisma/prisma.service';

const MAX_DELIVERY_ATTEMPTS = 8;
const OUTBOX_BATCH_SIZE = 20;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('SMTP_HOST')?.trim() &&
        this.config.get<string>('SMTP_USER')?.trim() &&
        this.config.get<string>('SMTP_PASSWORD')?.trim() &&
        this.config.get<string>('SMTP_FROM')?.trim(),
    );
  }

  private getTransporter(): Transporter | null {
    if (!this.isConfigured()) return null;
    if (this.transporter) return this.transporter;

    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST')!.trim(),
      port,
      secure: port === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER')!.trim(),
        pass: this.config.get<string>('SMTP_PASSWORD')!.trim(),
      },
      requireTLS: port === 587,
    });
    return this.transporter;
  }

  /** From used for outbound “human” mail (invites, admin broadcast). */
  outreachFrom(): string {
    return (
      this.config.get<string>('SMTP_BROADCAST_FROM')?.trim() ||
      'hello@builthai.com'
    );
  }

  outreachFromName(): string {
    return (
      this.config.get<string>('SMTP_BROADCAST_FROM_NAME')?.trim() ||
      this.config.get<string>('SMTP_FROM_NAME')?.trim() ||
      'BuilTHAI'
    );
  }

  async send(params: {
    to: string | string[];
    subject: string;
    html: string;
    text: string;
    /** Defaults to SMTP_FROM (noreply). Use for admin broadcast from hello@. */
    from?: string;
    fromName?: string;
    replyTo?: string;
    headers?: Record<string, string>;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType?: string;
    }>;
  }): Promise<boolean> {
    const transport = this.getTransporter();
    if (!transport) {
      this.logger.warn('SMTP not configured — skipping email');
      return false;
    }

    const from =
      params.from?.trim() || this.config.get<string>('SMTP_FROM')!.trim();
    const fromName =
      params.fromName?.trim() ||
      this.config.get<string>('SMTP_FROM_NAME')?.trim() ||
      'BuilTHAI';
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;
    const replyTo = params.replyTo?.trim() || undefined;

    // Emails with binary attachments are not persisted (buffers don't belong in
    // the outbox) — send them directly as before.
    if (params.attachments?.length) {
      try {
        await this.deliverWith(transport, {
          to,
          subject: params.subject,
          html: params.html,
          text: params.text,
          from,
          fromName,
          replyTo,
          headers: params.headers,
          attachments: params.attachments,
        });
        return true;
      } catch (error) {
        this.logger.warn('Failed to send email', error);
        return false;
      }
    }

    // Persist first, then attempt immediate delivery. If delivery fails the
    // row stays in the outbox and the cron retries it — critical notices
    // (fully-signed contract, platform-fee invoice) are no longer lost on a
    // transient SMTP error.
    try {
      const row = await this.prisma.emailOutbox.create({
        data: {
          to,
          subject: params.subject,
          html: params.html,
          text: params.text,
          from,
          fromName,
          replyTo: replyTo ?? null,
          headersJson: (params.headers ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      });
      await this.deliverRow(row.id, transport);
      return true;
    } catch (error) {
      this.logger.warn('Failed to enqueue email', error);
      return false;
    }
  }

  private async deliverWith(
    transport: Transporter,
    params: {
      to: string;
      subject: string;
      html: string;
      text: string;
      from: string;
      fromName: string;
      replyTo?: string;
      headers?: Record<string, string>;
      attachments?: Array<{
        filename: string;
        content: Buffer;
        contentType?: string;
      }>;
    },
  ): Promise<void> {
    await transport.sendMail({
      from: `"${params.fromName}" <${params.from}>`,
      to: params.to,
      replyTo: params.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: params.headers,
      attachments: params.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });
  }

  private async deliverRow(rowId: string, transport: Transporter): Promise<void> {
    // Claim the row so a concurrent flusher (or second replica) cannot double
    // send: push nextAttemptAt forward first, then re-read the claimed row.
    const claim = await this.prisma.emailOutbox.updateMany({
      where: { id: rowId, status: EmailOutboxStatus.pending },
      data: { nextAttemptAt: new Date(Date.now() + 60_000) },
    });
    if (claim.count !== 1) {
      return;
    }

    const row = await this.prisma.emailOutbox.findUniqueOrThrow({
      where: { id: rowId },
    });

    try {
      await this.deliverWith(transport, {
        to: row.to,
        subject: row.subject,
        html: row.html,
        text: row.text,
        from: row.from ?? '',
        fromName: row.fromName ?? 'BuilTHAI',
        replyTo: row.replyTo ?? undefined,
        headers: (row.headersJson as Record<string, string> | null) ?? undefined,
      });
      await this.prisma.emailOutbox.update({
        where: { id: rowId },
        data: { status: EmailOutboxStatus.sent, sentAt: new Date() },
      });
    } catch (error) {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= MAX_DELIVERY_ATTEMPTS;
      await this.prisma.emailOutbox.update({
        where: { id: rowId },
        data: {
          attempts,
          status: exhausted
            ? EmailOutboxStatus.failed
            : EmailOutboxStatus.pending,
          lastError:
            error instanceof Error ? error.message.slice(0, 2000) : String(error),
          nextAttemptAt: new Date(Date.now() + this.backoffMs(attempts)),
        },
      });
      if (exhausted) {
        this.logger.error(
          `Email outbox delivery permanently failed for ${row.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private backoffMs(attempts: number): number {
    return Math.min(60, 2 ** Math.min(attempts, 6)) * 60_000;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async flushOutbox(): Promise<void> {
    const transport = this.getTransporter();
    if (!transport) return;

    const rows = await this.prisma.emailOutbox.findMany({
      where: {
        status: EmailOutboxStatus.pending,
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: OUTBOX_BATCH_SIZE,
    });

    for (const row of rows) {
      await this.deliverRow(row.id, transport);
    }
  }
}
