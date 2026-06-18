import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

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

  async send(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    const transport = this.getTransporter();
    if (!transport) {
      this.logger.warn('SMTP not configured — skipping email');
      return false;
    }

    const from = this.config.get<string>('SMTP_FROM')!.trim();
    const fromName =
      this.config.get<string>('SMTP_FROM_NAME')?.trim() || 'Ant Construction';

    try {
      await transport.sendMail({
        from: `"${fromName}" <${from}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      return true;
    } catch (error) {
      this.logger.warn('Failed to send email', error);
      return false;
    }
  }
}
