import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationEmailKind,
  User,
  UserNotificationPreferences,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import {
  MATCHING_PROJECT_EMAILS_DAILY_CAP,
  NotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
} from './notification.types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private appUrl(): string {
    const url =
      this.config.get<string>('WEB_APP_URL')?.trim() ||
      this.config.get<string>('NEXT_PUBLIC_APP_URL')?.trim() ||
      'http://localhost:3000';
    return url.replace(/\/+$/, '');
  }

  private projectUrl(projectId: string): string {
    return `${this.appUrl()}/projects/${projectId}`;
  }

  private bidsUrl(projectId: string): string {
    return `${this.appUrl()}/projects/${projectId}/bids`;
  }

  private wrapEmail(title: string, bodyHtml: string, ctaHref: string, ctaLabel: string): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f4fa;font-family:system-ui,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;">
<tr><td style="padding:28px;">
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2563eb;text-transform:uppercase;">Ant Construction</p>
<h1 style="margin:0 0 12px;font-size:20px;">${escapeHtml(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#475569;">${bodyHtml}</div>
<p style="margin:24px 0 0;"><a href="${ctaHref}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">${escapeHtml(ctaLabel)}</a></p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  }

  async getOrCreatePreferences(userId: string): Promise<NotificationPreferencesDto> {
    const prefs = await this.prisma.userNotificationPreferences.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return this.mapPreferences(prefs);
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    const prefs = await this.prisma.userNotificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        emailEnabled: dto.emailEnabled ?? true,
        emailClientBidActivity: dto.emailClientBidActivity ?? true,
        emailContractorUpdates: dto.emailContractorUpdates ?? true,
        emailMatchingProjects: dto.emailMatchingProjects ?? true,
      },
      update: {
        ...(dto.emailEnabled !== undefined && { emailEnabled: dto.emailEnabled }),
        ...(dto.emailClientBidActivity !== undefined && {
          emailClientBidActivity: dto.emailClientBidActivity,
        }),
        ...(dto.emailContractorUpdates !== undefined && {
          emailContractorUpdates: dto.emailContractorUpdates,
        }),
        ...(dto.emailMatchingProjects !== undefined && {
          emailMatchingProjects: dto.emailMatchingProjects,
        }),
      },
    });
    return this.mapPreferences(prefs);
  }

  private mapPreferences(
    prefs: UserNotificationPreferences,
  ): NotificationPreferencesDto {
    return {
      emailEnabled: prefs.emailEnabled,
      emailClientBidActivity: prefs.emailClientBidActivity,
      emailContractorUpdates: prefs.emailContractorUpdates,
      emailMatchingProjects: prefs.emailMatchingProjects,
    };
  }

  private async shouldSend(
    userId: string,
    flag: keyof NotificationPreferencesDto,
  ): Promise<{ user: User; ok: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email?.trim()) {
      return { user: user!, ok: false };
    }

    const prefs = await this.getOrCreatePreferences(userId);
    if (!prefs.emailEnabled || !prefs[flag]) {
      return { user, ok: false };
    }

    return { user, ok: true };
  }

  private async logSent(
    userId: string,
    kind: NotificationEmailKind,
    projectId?: string,
  ): Promise<void> {
    await this.prisma.notificationEmailLog.create({
      data: { userId, kind, projectId },
    });
  }

  private async canSendMatchingToday(userId: string): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const count = await this.prisma.notificationEmailLog.count({
      where: {
        userId,
        kind: NotificationEmailKind.contractor_matching_project,
        sentAt: { gte: startOfDay },
      },
    });
    return count < MATCHING_PROJECT_EMAILS_DAILY_CAP;
  }

  private async sendToUser(params: {
    userId: string;
    prefFlag: keyof NotificationPreferencesDto;
    kind: NotificationEmailKind;
    projectId?: string;
    subject: string;
    title: string;
    bodyHtml: string;
    ctaHref: string;
    ctaLabel: string;
    textBody: string;
  }): Promise<void> {
    if (!this.mail.isConfigured()) return;

    const { user, ok } = await this.shouldSend(params.userId, params.prefFlag);
    if (!ok || !user.email) return;

    const html = this.wrapEmail(
      params.title,
      params.bodyHtml,
      params.ctaHref,
      params.ctaLabel,
    );
    const sent = await this.mail.send({
      to: user.email,
      subject: params.subject,
      html,
      text: `${params.title}\n\n${params.textBody}\n\n${params.ctaLabel}: ${params.ctaHref}`,
    });
    if (sent) {
      await this.logSent(params.userId, params.kind, params.projectId);
    }
  }

  async notifyClientBidEnrolled(params: {
    clientId: string;
    projectId: string;
    projectTitle: string;
    companyName: string;
    contenderNumber: number;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.clientId,
      prefFlag: 'emailClientBidActivity',
      kind: NotificationEmailKind.client_bid_enrolled,
      projectId: params.projectId,
      subject: `New contender on ${params.projectTitle}`,
      title: 'New tender application',
      bodyHtml: `<p><strong>${escapeHtml(params.companyName)}</strong> enrolled as contender <strong>#${params.contenderNumber}</strong> on your project <strong>${escapeHtml(params.projectTitle)}</strong>.</p>`,
      ctaHref: this.bidsUrl(params.projectId),
      ctaLabel: 'View applications',
      textBody: `${params.companyName} enrolled as contender #${params.contenderNumber} on ${params.projectTitle}.`,
    });
  }

  async notifyClientBidSubmitted(params: {
    clientId: string;
    projectId: string;
    projectTitle: string;
    companyName: string;
    amount: string;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.clientId,
      prefFlag: 'emailClientBidActivity',
      kind: NotificationEmailKind.client_bid_submitted,
      projectId: params.projectId,
      subject: `New proposal on ${params.projectTitle}`,
      title: 'Commercial proposal received',
      bodyHtml: `<p><strong>${escapeHtml(params.companyName)}</strong> submitted a commercial proposal on <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>Amount: <strong>${escapeHtml(params.amount)} THB</strong></p>`,
      ctaHref: this.bidsUrl(params.projectId),
      ctaLabel: 'Review proposal',
      textBody: `${params.companyName} submitted a proposal (${params.amount} THB) on ${params.projectTitle}.`,
    });
  }

  async notifyContractorCounterOffer(params: {
    contractorUserId: string;
    projectId: string;
    projectTitle: string;
    amount: string;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.contractorUserId,
      prefFlag: 'emailContractorUpdates',
      kind: NotificationEmailKind.contractor_counter_offer,
      projectId: params.projectId,
      subject: `Counter-offer on ${params.projectTitle}`,
      title: 'Client sent a counter-offer',
      bodyHtml: `<p>The client sent a counter-offer on <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>Amount: <strong>${escapeHtml(params.amount)} THB</strong></p>`,
      ctaHref: this.projectUrl(params.projectId),
      ctaLabel: 'View project',
      textBody: `Counter-offer on ${params.projectTitle}: ${params.amount} THB.`,
    });
  }

  async notifyBidMessage(params: {
    recipientUserId: string;
    recipientRole: 'client' | 'contractor';
    projectId: string;
    projectTitle: string;
    preview: string;
  }): Promise<void> {
    const prefFlag =
      params.recipientRole === 'client'
        ? 'emailClientBidActivity'
        : 'emailContractorUpdates';

    const preview =
      params.preview.length > 200
        ? `${params.preview.slice(0, 197)}…`
        : params.preview;

    await this.sendToUser({
      userId: params.recipientUserId,
      prefFlag,
      kind: NotificationEmailKind.contractor_bid_message,
      projectId: params.projectId,
      subject: `New message on ${params.projectTitle}`,
      title: 'New message on your bid',
      bodyHtml: `<p>You have a new message regarding <strong>${escapeHtml(params.projectTitle)}</strong>:</p><p style="background:#f8fafc;padding:12px;border-radius:8px;">${escapeHtml(preview)}</p>`,
      ctaHref:
        params.recipientRole === 'client'
          ? this.bidsUrl(params.projectId)
          : this.projectUrl(params.projectId),
      ctaLabel:
        params.recipientRole === 'client' ? 'View applications' : 'Open conversation',
      textBody: `New message on ${params.projectTitle}: ${preview}`,
    });
  }

  async notifyContractorBidSelected(params: {
    contractorUserId: string;
    projectId: string;
    projectTitle: string;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.contractorUserId,
      prefFlag: 'emailContractorUpdates',
      kind: NotificationEmailKind.contractor_bid_selected,
      projectId: params.projectId,
      subject: `You were selected — ${params.projectTitle}`,
      title: 'Your bid was selected',
      bodyHtml: `<p>Congratulations! You were selected as the contractor for <strong>${escapeHtml(params.projectTitle)}</strong>.</p>`,
      ctaHref: this.projectUrl(params.projectId),
      ctaLabel: 'Open project',
      textBody: `You were selected for ${params.projectTitle}.`,
    });
  }

  async notifyContractorBidRejected(params: {
    contractorUserId: string;
    projectId: string;
    projectTitle: string;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.contractorUserId,
      prefFlag: 'emailContractorUpdates',
      kind: NotificationEmailKind.contractor_bid_rejected,
      projectId: params.projectId,
      subject: `Tender update — ${params.projectTitle}`,
      title: 'Another contractor was selected',
      bodyHtml: `<p>The client selected another contractor for <strong>${escapeHtml(params.projectTitle)}</strong>. Thank you for participating.</p>`,
      ctaHref: this.appUrl(),
      ctaLabel: 'Browse projects',
      textBody: `Another contractor was selected for ${params.projectTitle}.`,
    });
  }

  async notifyMatchingContractorsForProject(projectId: string): Promise<void> {
    if (!this.mail.isConfigured()) return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tags: { include: { tag: true } },
        tender: { select: { id: true, status: true } },
      },
    });
    if (!project?.tender) return;

    const projectTagSlugs = project.tags.map((row) => row.tag.slug);

    const contractors = await this.prisma.contractorProfile.findMany({
      where: {
        regionCode: project.regionCode,
        userId: { not: project.clientId },
      },
      include: { user: true },
    });

    for (const contractor of contractors) {
      const tagSlugs = contractor.tagSlugs ?? [];
      const tagMatch =
        tagSlugs.length === 0 ||
        tagSlugs.some((slug) => projectTagSlugs.includes(slug));
      if (!tagMatch) continue;

      const existingBid = await this.prisma.bid.findFirst({
        where: {
          tenderId: project.tender.id,
          contractorId: contractor.id,
          status: { not: 'withdrawn' },
        },
        select: { id: true },
      });
      if (existingBid) continue;

      const { ok } = await this.shouldSend(
        contractor.userId,
        'emailMatchingProjects',
      );
      if (!ok) continue;

      if (!(await this.canSendMatchingToday(contractor.userId))) continue;

      await this.sendToUser({
        userId: contractor.userId,
        prefFlag: 'emailMatchingProjects',
        kind: NotificationEmailKind.contractor_matching_project,
        projectId,
        subject: `New project: ${project.title}`,
        title: 'New project matching your specialties',
        bodyHtml: `<p>A new project <strong>${escapeHtml(project.title)}</strong>${project.district ? ` in ${escapeHtml(project.district)}` : ''} is open for bids and matches your profile.</p>`,
        ctaHref: this.projectUrl(projectId),
        ctaLabel: 'View project',
        textBody: `New matching project: ${project.title}.`,
      });
    }
  }

  dispatch(promise: Promise<void>): void {
    void promise.catch((error) => {
      this.logger.warn('Notification dispatch failed', error);
    });
  }
}
