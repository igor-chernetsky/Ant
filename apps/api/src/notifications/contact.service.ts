import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMemoryRateLimiter } from '../common/rate-limit';
import { DEFAULT_PLATFORM_ADMIN_EMAIL } from './platform-fees';
import { MailService } from './mail.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_RE = /^[+()\d\s.-]{6,32}$/;
const MAX_MESSAGE_LEN = 5000;

/** A single contact identifier can submit at most this often. */
const CONTACT_IDENTIFIER_LIMITER = createMemoryRateLimiter({
  windowMs: 15 * 60_000,
  max: 3,
});

/** Per-IP guard so a scripted flood cannot rotate identifiers. */
const CONTACT_IP_LIMITER = createMemoryRateLimiter({
  windowMs: 15 * 60_000,
  max: 20,
});

export interface SubmitContactMessageDto {
  email?: string;
  phone?: string;
  message: string;
}

export interface SubmitContactMessageContext {
  clientIp?: string;
}

function rateLimited(): never {
  throw new HttpException(
    {
      message: 'Too many messages. Please try again later.',
      code: 'rate_limited',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

@Injectable()
export class ContactService {
  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async submitContactMessage(
    body: SubmitContactMessageDto,
    context: SubmitContactMessageContext = {},
  ): Promise<{ sent: true }> {
    if (!this.mail.isConfigured()) {
      throw new ServiceUnavailableException('SMTP is not configured');
    }

    const email = body.email?.trim().toLowerCase() ?? '';
    const phone = body.phone?.trim() ?? '';
    const message = body.message?.trim() ?? '';

    if (!email && !phone) {
      throw new BadRequestException('Email or phone is required');
    }
    if (email && !EMAIL_RE.test(email)) {
      throw new BadRequestException('Invalid email address');
    }
    if (phone && !PHONE_RE.test(phone)) {
      throw new BadRequestException('Invalid phone number');
    }
    if (!message) {
      throw new BadRequestException('Message is required');
    }
    if (message.length > MAX_MESSAGE_LEN) {
      throw new BadRequestException('Message is too long');
    }

    // Rate limiting by the contact identifier and (when known) the IP.
    const contactKey = email || `phone:${phone}`;
    const identifierCheck = CONTACT_IDENTIFIER_LIMITER.check(contactKey);
    if (!identifierCheck.ok) {
      rateLimited();
    }
    if (context.clientIp) {
      const ipCheck = CONTACT_IP_LIMITER.check(context.clientIp);
      if (!ipCheck.ok) {
        rateLimited();
      }
    }

    const to =
      this.config.get<string>('PLATFORM_ADMIN_EMAIL')?.trim() ||
      DEFAULT_PLATFORM_ADMIN_EMAIL;
    const from =
      this.config.get<string>('SMTP_BROADCAST_FROM')?.trim() ||
      this.config.get<string>('SMTP_FROM')?.trim() ||
      DEFAULT_PLATFORM_ADMIN_EMAIL;
    const fromName =
      this.config.get<string>('SMTP_BROADCAST_FROM_NAME')?.trim() ||
      this.config.get<string>('SMTP_FROM_NAME')?.trim() ||
      'BuilTHAI';

    const subject = 'BuilTHAI contact form message';
    const text = [
      'New contact form submission',
      '',
      email ? `Email: ${email}` : null,
      phone ? `Phone: ${phone}` : null,
      '',
      message,
    ]
      .filter((line): line is string => line != null)
      .join('\n');

    const html = [
      '<p><strong>New contact form submission</strong></p>',
      email ? `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` : '',
      phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : '',
      `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    ].join('');

    const sent = await this.mail.send({
      to,
      subject,
      html,
      text,
      from,
      fromName,
      replyTo: email || undefined,
    });
    if (!sent) {
      throw new ServiceUnavailableException('Failed to send message');
    }

    return { sent: true };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
