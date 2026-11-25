import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailOutboxStatus, Prisma } from '@prisma/client';
import nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';
import { PrismaService } from '../prisma/prisma.service';

const MAX_DELIVERY_ATTEMPTS = 8;
const OUTBOX_BATCH_SIZE = 20;

/** Address every "human" mail is sent from and replied to. */
export const DEFAULT_OUTREACH_FROM = 'hello@builthai.com';
/** Address transactional mail is sent from; no reply is expected. */
export const DEFAULT_TRANSACTIONAL_FROM = 'noreply@builthai.com';

/**
 * The only domain our own mail is sent from — the one verified in Resend
 * (`resend._domainkey.builthai.com`) and the one with Porkbun forwarding MX records.
 *
 * A subdomain such as `mail.builthai.com` is a mail *host* name, not a mailbox
 * domain: it has no MX record, so a reply to `hello@mail.builthai.com` fails with
 * `DNS type 'mx' lookup … NXDOMAIN` on the recipient's side.
 */
export const OWN_MAIL_DOMAIN = 'builthai.com';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Values already reported, so a request loop cannot flood the log. */
const warnedValues = new Set<string>();

function warnOnce(
  message: string,
  onWarn: (message: string) => void,
): void {
  if (warnedValues.has(message)) {
    return;
  }
  warnedValues.add(message);
  onWarn(message);
}

/**
 * Turns a configured mail address into one that can actually receive replies.
 *
 * The outreach address is used three times: as `From`, as `Reply-To`, and inside
 * the `List-Unsubscribe: mailto:` header. A typo there is invisible while mail is
 * being delivered — the failure surfaces later, as a bounce when the recipient
 * presses Reply. `buildthai.com` (extra "d") is parked and has **no MX record**, so
 * every reply to it is rejected before it reaches any mailbox; that is exactly the
 * "cannot send the email" error a recipient sees.
 *
 * The same correction already exists for `WEB_APP_URL` / `NEXT_PUBLIC_APP_URL`
 * (`app-base-url.ts`); the mail path had no such guard.
 */
export function normalizeMailAddress(
  raw: string | null | undefined,
  fallback: string,
  label: string,
  onWarn: (message: string) => void = (message) => console.warn(message),
): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return fallback;
  }

  // Accept `"Name" <address>` as well as a bare address.
  const bracketed = trimmed.match(/<([^>]+)>/);
  let address = (bracketed ? bracketed[1]! : trimmed).trim();

  if (/buildthai\.com/i.test(address)) {
    const fixed = address.replace(/buildthai\.com/gi, 'builthai.com');
    warnOnce(
      `[mail] ${label} "${address}" uses the typo domain buildthai.com (no MX) — using "${fixed}". Replies to the original address bounce.`,
      onWarn,
    );
    address = fixed;
  }

  if (!EMAIL_RE.test(address)) {
    warnOnce(
      `[mail] ${label} "${trimmed}" is not a valid email address — using "${fallback}".`,
      onWarn,
    );
    return fallback;
  }

  return address;
}

/**
 * The same guard for addresses **we** own: `From`, the outreach/reply-to address and
 * `List-Unsubscribe`. Unlike a visitor's address (the contact form replies to the
 * sender), these must live on {@link OWN_MAIL_DOMAIN}, because that is the only
 * verified sending domain and the only one with inbound MX records.
 *
 * `hello@mail.builthai.com` is corrected to `hello@builthai.com`: `mail.` is a mail
 * *server* name, and the subdomain has no MX record — replying to it fails with
 * `NXDOMAIN`, while sending still works, so the mistake is invisible until someone
 * presses Reply.
 */
export function normalizeOwnAddress(
  raw: string | null | undefined,
  fallback: string,
  label: string,
  onWarn: (message: string) => void = (message) => console.warn(message),
): string {
  const address = normalizeMailAddress(raw, fallback, label, onWarn);
  const at = address.lastIndexOf('@');
  const local = at > 0 ? address.slice(0, at) : '';
  const domain = at > 0 ? address.slice(at + 1).toLowerCase() : '';

  if (domain === OWN_MAIL_DOMAIN) {
    return address;
  }

  if (domain.endsWith(`.${OWN_MAIL_DOMAIN}`) && local) {
    const fixed = `${local}@${OWN_MAIL_DOMAIN}`;
    warnOnce(
      `[mail] ${label} "${address}" points at a subdomain, not the mailbox domain — using "${fixed}". "${domain}" has no MX record, so replies to it bounce.`,
      onWarn,
    );
    return fixed;
  }

  warnOnce(
    `[mail] ${label} "${address}" is not on ${OWN_MAIL_DOMAIN} (the only verified sending domain) — using "${fallback}".`,
    onWarn,
  );
  return fallback;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Report the addresses the process actually uses at startup, so a typo is visible
   * in the logs instead of surfacing as a silent bounce days later.
   */
  onModuleInit(): void {
    if (!this.isConfigured()) {
      this.logger.warn('SMTP is not configured — outgoing email is disabled');
      return;
    }
    this.logger.log(
      `Email enabled: from ${this.transactionalFrom()}, outreach/reply-to ${this.outreachFrom()}`,
    );
  }

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

  /** From used for transactional mail (password reset, notifications). */
  transactionalFrom(): string {
    return normalizeOwnAddress(
      this.config.get<string>('SMTP_FROM'),
      DEFAULT_TRANSACTIONAL_FROM,
      'SMTP_FROM',
      (message) => this.logger.warn(message),
    );
  }

  /** From used for outbound “human” mail (invites, admin broadcast). */
  outreachFrom(): string {
    return normalizeOwnAddress(
      this.config.get<string>('SMTP_BROADCAST_FROM'),
      DEFAULT_OUTREACH_FROM,
      'SMTP_BROADCAST_FROM',
      (message) => this.logger.warn(message),
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

    // `from`/`replyTo` come from callers (invites, broadcast, contact form), so they
    // still go through the same guard: a typo in any env-driven address must not turn
    // into "delivered fine, but every reply bounces".
    const from = normalizeOwnAddress(
      params.from?.trim() || this.config.get<string>('SMTP_FROM'),
      this.transactionalFrom(),
      'From',
      (message) => this.logger.warn(message),
    );
    const fromName =
      params.fromName?.trim() ||
      this.config.get<string>('SMTP_FROM_NAME')?.trim() ||
      'BuilTHAI';
    const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;
    const replyTo = params.replyTo?.trim()
      ? normalizeMailAddress(
          params.replyTo,
          this.outreachFrom(),
          'Reply-To',
          (message) => this.logger.warn(message),
        )
      : undefined;

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
