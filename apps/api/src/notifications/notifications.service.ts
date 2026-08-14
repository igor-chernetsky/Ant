import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BidStatus,
  InAppNotificationKind,
  NotificationEmailKind,
  Prisma,
  TenderStatus,
  User,
  UserNotificationPreferences,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveAppBaseUrl } from '../common/app-base-url';
import { LocationsService } from '../locations/locations.service';
import { ProjectLocalizationService } from '../localization/project-localization.service';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from '../users/locale.types';
import { MailService } from './mail.service';
import { bidMessageEmailCopy } from './notification-i18n';
import {
  contractorProjectTypeMatches,
  contractorTagsMatchProject,
} from '../tendering/contractor-project-matching.util';
import {
  MATCHING_PROJECT_EMAILS_DAILY_CAP,
  NotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
  type InAppNotificationDto,
  type InAppNotificationsListDto,
  type MarkInAppNotificationsReadDto,
} from './notification.types';
import { PlatformSettingsService } from './platform-settings.service';

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
    private readonly locations: LocationsService,
    private readonly config: ConfigService,
    private readonly projectLocalization: ProjectLocalizationService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private appUrl(): string {
    return resolveAppBaseUrl((key) => this.config.get<string>(key));
  }

  private projectUrl(projectId: string): string {
    return `${this.appUrl()}/projects/${projectId}`;
  }

  private bidsUrl(projectId: string): string {
    return `${this.appUrl()}/projects/${projectId}/bids`;
  }

  private bidsPath(projectId: string): string {
    return `/projects/${projectId}/bids`;
  }

  private projectPath(projectId: string): string {
    return `/projects/${projectId}`;
  }

  private progressClaimsPath(projectId: string): string {
    return `/projects/${projectId}#progress-claims`;
  }

  private progressClaimsUrl(projectId: string): string {
    return `${this.projectUrl(projectId)}#progress-claims`;
  }

  private formatThbAmount(amount: number): string {
    return Math.round(amount).toLocaleString('en-US');
  }

  private mapInAppNotification(row: {
    id: string;
    kind: InAppNotificationKind;
    href: string | null;
    projectId: string | null;
    payload: Prisma.JsonValue | null;
    readAt: Date | null;
    createdAt: Date;
  }): InAppNotificationDto {
    const payload =
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, string | number | null>)
        : null;
    return {
      id: row.id,
      kind: row.kind,
      href: row.href,
      projectId: row.projectId,
      payload,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async createInAppNotification(params: {
    userId: string;
    kind: InAppNotificationKind;
    href?: string;
    projectId?: string;
    payload?: Record<string, string | number | null>;
  }): Promise<void> {
    try {
      await this.prisma.inAppNotification.create({
        data: {
          userId: params.userId,
          kind: params.kind,
          href: params.href,
          projectId: params.projectId,
          payload: params.payload
            ? (params.payload as Prisma.InputJsonValue)
            : undefined,
        },
      });
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to create in-app notification ${params.kind}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async listInAppNotifications(
    userId: string,
    options?: { limit?: number },
  ): Promise<InAppNotificationsListDto> {
    const take = Math.min(Math.max(options?.limit ?? 30, 1), 50);
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.inAppNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.inAppNotification.count({
        where: { userId, readAt: null },
      }),
    ]);

    return {
      notifications: notifications.map((row) => this.mapInAppNotification(row)),
      unreadCount,
    };
  }

  async markInAppNotificationsRead(
    userId: string,
    body: MarkInAppNotificationsReadDto = {},
  ): Promise<InAppNotificationsListDto> {
    const ids = body.ids?.filter(Boolean) ?? [];
    await this.prisma.inAppNotification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(ids.length > 0 ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });
    return this.listInAppNotifications(userId);
  }

  private wrapEmail(
    title: string,
    bodyHtml: string,
    ctaHref: string,
    ctaLabel: string,
    locale: SupportedLocale = DEFAULT_LOCALE,
  ): string {
    return `<!DOCTYPE html>
<html lang="${locale}"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f4fa;font-family:system-ui,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;">
<tr><td style="padding:28px;">
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2563eb;text-transform:uppercase;">BuilTHAI</p>
<h1 style="margin:0 0 12px;font-size:20px;">${escapeHtml(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#475569;">${bodyHtml}</div>
<p style="margin:24px 0 0;"><a href="${ctaHref}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">${escapeHtml(ctaLabel)}</a></p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  }

  private resolveUserLocale(user: Pick<User, 'preferredLocale'>): SupportedLocale {
    return isSupportedLocale(user.preferredLocale)
      ? user.preferredLocale
      : DEFAULT_LOCALE;
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

  private async hasSentTenderOpenedEmail(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const row = await this.prisma.notificationEmailLog.findFirst({
      where: {
        userId,
        projectId,
        kind: NotificationEmailKind.contractor_tender_opened,
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  private async shouldSendTenderOpened(
    userId: string,
  ): Promise<{ user: User; ok: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email?.trim()) {
      return { user: user!, ok: false };
    }

    const prefs = await this.getOrCreatePreferences(userId);
    if (!prefs.emailEnabled) {
      return { user, ok: false };
    }
    if (prefs.emailMatchingProjects || prefs.emailContractorUpdates) {
      return { user, ok: true };
    }
    return { user, ok: false };
  }

  private clarificationSummaryBlocks(summary: string | null | undefined): {
    summaryBlock: string;
    summaryText: string;
  } {
    const trimmed = summary?.trim();
    if (!trimmed) {
      return { summaryBlock: '', summaryText: '' };
    }
    return {
      summaryBlock: `<div style="margin-top:16px;padding:14px 16px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;">
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;">Clarification summary</p>
<p style="margin:0;font-size:14px;line-height:1.55;color:#475569;white-space:pre-wrap;">${escapeHtml(trimmed)}</p>
</div>`,
      summaryText: `\n\nClarification summary:\n${trimmed}`,
    };
  }

  private async loadMatchingContractorsForProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tags: { include: { tag: true } },
        tender: { select: { id: true, status: true } },
      },
    });
    if (!project?.tender) return null;

    const tender = project.tender;
    const projectTagSlugs = project.tags.map((row) => row.tag.slug);
    const projectLocation = {
      regionSlug: project.locationRegionSlug,
      areaSlug: project.locationAreaSlug,
    };

    const candidates = await this.prisma.contractorProfile.findMany({
      where: {
        regionCode: project.regionCode,
        userId: { not: project.clientId },
        kind: project.projectType === 'design' ? 'designer' : 'contractor',
        OR: [
          { projectTypes: { isEmpty: true } },
          { projectTypes: { has: project.projectType } },
        ],
      },
      include: { user: true },
    });

    const contractors = candidates.filter((contractor) => {
      const serviceLocations = this.locations.normalizeServiceLocations(
        contractor.serviceLocationsJson,
      );
      if (
        !this.locations.contractorMatchesProject(
          serviceLocations,
          projectLocation,
        )
      ) {
        return false;
      }
      if (
        !contractorProjectTypeMatches(
          contractor.projectTypes ?? [],
          project.projectType,
        )
      ) {
        return false;
      }
      return contractorTagsMatchProject(
        contractor.tagSlugs ?? [],
        projectTagSlugs,
      );
    });

    return { project, tender, contractors };
  }

  private async sendTenderOpenedEmail(params: {
    userId: string;
    user: User;
    projectId: string;
    subject: string;
    title: string;
    bodyHtml: string;
    textBody: string;
  }): Promise<boolean> {
    if (!this.mail.isConfigured()) return false;

    const locale = this.resolveUserLocale(params.user);
    const ctaHref = this.projectUrl(params.projectId);
    const ctaLabel = 'View project';
    const html = this.wrapEmail(
      params.title,
      params.bodyHtml,
      ctaHref,
      ctaLabel,
      locale,
    );
    const sent = await this.mail.send({
      to: params.user.email!,
      subject: params.subject,
      html,
      text: `${params.title}\n\n${params.textBody}\n\n${ctaLabel}: ${ctaHref}`,
    });
    if (sent) {
      await this.logSent(
        params.userId,
        NotificationEmailKind.contractor_tender_opened,
        params.projectId,
      );
    }
    return sent;
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
    locale?: SupportedLocale;
  }): Promise<void> {
    if (!this.mail.isConfigured()) return;

    const { user, ok } = await this.shouldSend(params.userId, params.prefFlag);
    if (!ok || !user.email) return;

    const locale = params.locale ?? this.resolveUserLocale(user);
    const html = this.wrapEmail(
      params.title,
      params.bodyHtml,
      params.ctaHref,
      params.ctaLabel,
      locale,
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

  private contractorPortalUrl(): string {
    return `${this.appUrl()}/contractor`;
  }

  private async sendAccountEmail(params: {
    userId: string;
    kind: NotificationEmailKind;
    subject: string;
    title: string;
    bodyHtml: string;
    ctaHref: string;
    ctaLabel: string;
    textBody: string;
  }): Promise<void> {
    if (!this.mail.isConfigured()) return;

    const user = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!user?.email?.trim()) return;

    const prefs = await this.getOrCreatePreferences(params.userId);
    if (!prefs.emailEnabled) return;

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
      await this.logSent(params.userId, params.kind);
    }
  }

  async notifyContractorVerificationApproved(params: {
    contractorUserId: string;
    companyName: string | null;
  }): Promise<void> {
    const label = params.companyName?.trim() || 'your company';
    await this.sendAccountEmail({
      userId: params.contractorUserId,
      kind: NotificationEmailKind.contractor_verification_approved,
      subject: 'Contractor verification approved',
      title: 'Verification approved',
      bodyHtml: `<p>Your contractor verification for <strong>${escapeHtml(label)}</strong> has been approved.</p><p>You can now use verified contractor features on BuilTHAI, including portfolio visibility.</p>`,
      ctaHref: this.contractorPortalUrl(),
      ctaLabel: 'Open contractor portal',
      textBody: `Verification approved for ${label}. Open the contractor portal to continue.`,
    });
  }

  async notifyContractorVerificationRejected(params: {
    contractorUserId: string;
    companyName: string | null;
    comment: string;
  }): Promise<void> {
    const label = params.companyName?.trim() || 'your company';
    await this.sendAccountEmail({
      userId: params.contractorUserId,
      kind: NotificationEmailKind.contractor_verification_rejected,
      subject: 'Contractor verification not approved',
      title: 'Verification not approved',
      bodyHtml: `<p>Your contractor verification for <strong>${escapeHtml(label)}</strong> was not approved.</p><p style="background:#f8fafc;padding:12px;border-radius:8px;white-space:pre-wrap;">${escapeHtml(params.comment)}</p><p>You can update your documents and submit a new verification request from the contractor portal.</p>`,
      ctaHref: this.contractorPortalUrl(),
      ctaLabel: 'Open contractor portal',
      textBody: `Verification not approved for ${label}.\n\nReason: ${params.comment}`,
    });
  }

  async notifyClientBidEnrolled(params: {
    clientId: string;
    projectId: string;
    projectTitle: string;
    companyName: string;
    contenderNumber: number;
  }): Promise<void> {
    // Participation is surfaced to the client only when a commercial proposal
    // is submitted (see notifyClientBidSubmitted). Enrollment alone is silent.
    void params;
  }

  async notifyClientClarificationQuestions(params: {
    clientId: string;
    projectId: string;
    projectTitle: string;
    companyName: string;
    questionCount: number;
  }): Promise<void> {
    const countLabel =
      params.questionCount === 1
        ? '1 clarification question'
        : `${params.questionCount} clarification questions`;

    await this.createInAppNotification({
      userId: params.clientId,
      kind: InAppNotificationKind.client_clarification_questions,
      href: this.projectPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        companyName: params.companyName,
        questionCount: params.questionCount,
      },
    });
    await this.sendToUser({
      userId: params.clientId,
      prefFlag: 'emailClientBidActivity',
      kind: NotificationEmailKind.client_clarification_questions,
      projectId: params.projectId,
      subject: `Clarification questions on ${params.projectTitle}`,
      title: 'New clarification questions',
      bodyHtml: `<p><strong>${escapeHtml(params.companyName)}</strong> submitted <strong>${escapeHtml(countLabel)}</strong> on your project <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>Review and answer them before opening the tender for commercial proposals.</p>`,
      ctaHref: this.projectUrl(params.projectId),
      ctaLabel: 'Open project',
      textBody: `${params.companyName} submitted ${countLabel} on ${params.projectTitle}.`,
    });
  }

  async notifyClientBidSubmitted(params: {
    clientId: string;
    projectId: string;
    projectTitle: string;
    companyName: string;
    amount: string;
  }): Promise<void> {
    await this.createInAppNotification({
      userId: params.clientId,
      kind: InAppNotificationKind.client_bid_submitted,
      href: this.bidsPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        companyName: params.companyName,
        amount: params.amount,
      },
    });
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

  async notifyClientTenderDeadlineReached(params: {
    clientId: string;
    projectId: string;
    projectTitle: string;
    applicationCount: number;
    submittedBidCount: number;
  }): Promise<void> {
    const appsLabel =
      params.applicationCount === 1 ? 'application' : 'applications';
    const proposalsPart =
      params.submittedBidCount > 0
        ? ` ${params.submittedBidCount} commercial proposal${params.submittedBidCount === 1 ? '' : 's'} received.`
        : '';

    await this.createInAppNotification({
      userId: params.clientId,
      kind: InAppNotificationKind.client_tender_deadline_reached,
      href: this.bidsPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        applicationCount: params.applicationCount,
        submittedBidCount: params.submittedBidCount,
      },
    });
    await this.sendToUser({
      userId: params.clientId,
      prefFlag: 'emailClientBidActivity',
      kind: NotificationEmailKind.client_tender_deadline_reached,
      projectId: params.projectId,
      subject: `Application deadline reached — ${params.projectTitle}`,
      title: 'Tender application deadline reached',
      bodyHtml: `<p>The application deadline for <strong>${escapeHtml(params.projectTitle)}</strong> has passed.</p><p>You received <strong>${params.applicationCount}</strong> ${appsLabel}.${proposalsPart}</p><p>Review applications and select a contractor, or extend the deadline if you need more time.</p>`,
      ctaHref: this.bidsUrl(params.projectId),
      ctaLabel: 'Review applications',
      textBody: `Application deadline reached for ${params.projectTitle}. ${params.applicationCount} ${appsLabel}.${proposalsPart}`,
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
    messageId?: string;
  }): Promise<void> {
    const prefFlag =
      params.recipientRole === 'client'
        ? 'emailClientBidActivity'
        : 'emailContractorUpdates';

    const recipient = await this.prisma.user.findUnique({
      where: { id: params.recipientUserId },
      select: { preferredLocale: true },
    });
    const locale = recipient
      ? this.resolveUserLocale(recipient)
      : DEFAULT_LOCALE;
    const copy = bidMessageEmailCopy(locale);

    const projectTitle =
      await this.projectLocalization.getLocalizedProjectTitle(
        params.projectId,
        params.projectTitle,
        locale,
      );

    const localizedPreview = params.messageId
      ? await this.projectLocalization.localizeTextAuto(
          params.projectId,
          `bidMessage.${params.messageId}`,
          params.preview,
          locale,
        )
      : params.preview;

    const preview =
      localizedPreview.length > 200
        ? `${localizedPreview.slice(0, 197)}…`
        : localizedPreview;

    if (params.recipientRole === 'client') {
      await this.createInAppNotification({
        userId: params.recipientUserId,
        kind: InAppNotificationKind.client_bid_message,
        href: this.projectPath(params.projectId),
        projectId: params.projectId,
        payload: {
          projectTitle,
          preview,
        },
      });
    }

    await this.sendToUser({
      userId: params.recipientUserId,
      prefFlag,
      kind: NotificationEmailKind.contractor_bid_message,
      projectId: params.projectId,
      locale,
      subject: copy.subject(projectTitle),
      title: copy.title,
      bodyHtml: `<p>${copy.bodyLead(escapeHtml(projectTitle))}</p><p style="background:#f8fafc;padding:12px;border-radius:8px;">${escapeHtml(preview)}</p>`,
      ctaHref:
        params.recipientRole === 'client'
          ? this.projectUrl(params.projectId)
          : this.projectUrl(params.projectId),
      ctaLabel:
        params.recipientRole === 'client'
          ? copy.ctaClient
          : copy.ctaContractor,
      textBody: `${copy.title}: ${projectTitle}: ${preview}`,
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
      bodyHtml: `<p>Congratulations! You were selected as the contractor for <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>Review the contract draft and sign it on the project page to start work.</p>`,
      ctaHref: this.projectUrl(params.projectId),
      ctaLabel: 'Sign contract',
      textBody: `You were selected for ${params.projectTitle}. Sign the contract on the project page.`,
    });
  }

  async notifyContractPartySigned(params: {
    recipientUserId: string;
    signerRole: 'client' | 'contractor';
    projectId: string;
    projectTitle: string;
  }): Promise<void> {
    const signerLabel =
      params.signerRole === 'client' ? 'The client' : 'The contractor';
    const isClientRecipient = params.signerRole === 'contractor';

    await this.sendToUser({
      userId: params.recipientUserId,
      prefFlag: isClientRecipient
        ? 'emailClientBidActivity'
        : 'emailContractorUpdates',
      kind: NotificationEmailKind.contract_party_signed,
      projectId: params.projectId,
      subject: `Contract signed — ${params.projectTitle}`,
      title: 'Contract awaiting your signature',
      bodyHtml: `<p>${signerLabel} signed the contract for <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>Please review the contract draft and add your signature to activate the project.</p>`,
      ctaHref: isClientRecipient
        ? this.bidsUrl(params.projectId)
        : this.projectUrl(params.projectId),
      ctaLabel: 'Sign contract',
      textBody: `${signerLabel} signed the contract for ${params.projectTitle}. Your signature is required.`,
    });
  }

  async notifyContractFullySigned(params: {
    clientUserId: string;
    contractorUserId: string;
    projectId: string;
    projectTitle: string;
  }): Promise<void> {
    const payload = {
      projectId: params.projectId,
      subject: `Contract active — ${params.projectTitle}`,
      title: 'Contract fully signed',
      bodyHtml: `<p>Both parties signed the contract for <strong>${escapeHtml(params.projectTitle)}</strong>. The project is now active.</p>`,
      ctaHref: this.projectUrl(params.projectId),
      ctaLabel: 'Open project',
      textBody: `Contract fully signed for ${params.projectTitle}. The project is now active.`,
    };

    await Promise.all([
      this.sendToUser({
        userId: params.clientUserId,
        prefFlag: 'emailClientBidActivity',
        kind: NotificationEmailKind.contract_fully_signed,
        ...payload,
        ctaHref: this.bidsUrl(params.projectId),
        ctaLabel: 'View project',
      }),
      this.sendToUser({
        userId: params.contractorUserId,
        prefFlag: 'emailContractorUpdates',
        kind: NotificationEmailKind.contract_fully_signed,
        ...payload,
      }),
    ]);
  }

  async notifyContractAddendumCreated(params: {
    recipientUserId: string;
    projectId: string;
    projectTitle: string;
    addendumTitle: string;
    addendumId: string;
    createdByIsClient: boolean;
  }): Promise<void> {
    const creatorLabel = params.createdByIsClient
      ? 'The client'
      : 'The contractor';
    const isClientRecipient = !params.createdByIsClient;
    const href = this.projectPath(params.projectId);

    await this.createInAppNotification({
      userId: params.recipientUserId,
      kind: InAppNotificationKind.contract_addendum_created,
      href,
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        addendumTitle: params.addendumTitle,
      },
    });

    await this.sendToUser({
      userId: params.recipientUserId,
      prefFlag: isClientRecipient
        ? 'emailClientBidActivity'
        : 'emailContractorUpdates',
      kind: NotificationEmailKind.contract_addendum_created,
      projectId: params.projectId,
      subject: `Additional agreement — ${params.projectTitle}`,
      title: 'New additional agreement',
      bodyHtml: `<p>${creatorLabel} created an additional agreement <strong>${escapeHtml(params.addendumTitle)}</strong> for <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>The contractor must sign first, then the client.</p>`,
      ctaHref: isClientRecipient
        ? this.bidsUrl(params.projectId)
        : this.projectUrl(params.projectId),
      ctaLabel: 'Review agreement',
      textBody: `${creatorLabel} created additional agreement "${params.addendumTitle}" for ${params.projectTitle}.`,
    });
  }

  async notifyContractAddendumPartySigned(params: {
    recipientUserId: string;
    signerRole: 'client' | 'contractor';
    projectId: string;
    projectTitle: string;
    addendumTitle: string;
  }): Promise<void> {
    const signerLabel =
      params.signerRole === 'client' ? 'The client' : 'The contractor';
    const isClientRecipient = params.signerRole === 'contractor';

    await this.createInAppNotification({
      userId: params.recipientUserId,
      kind: InAppNotificationKind.contract_addendum_party_signed,
      href: this.projectPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        addendumTitle: params.addendumTitle,
      },
    });

    await this.sendToUser({
      userId: params.recipientUserId,
      prefFlag: isClientRecipient
        ? 'emailClientBidActivity'
        : 'emailContractorUpdates',
      kind: NotificationEmailKind.contract_addendum_party_signed,
      projectId: params.projectId,
      subject: `Additional agreement signed — ${params.projectTitle}`,
      title: 'Your signature is needed',
      bodyHtml: `<p>${signerLabel} signed additional agreement <strong>${escapeHtml(params.addendumTitle)}</strong> for <strong>${escapeHtml(params.projectTitle)}</strong>.</p>`,
      ctaHref: isClientRecipient
        ? this.bidsUrl(params.projectId)
        : this.projectUrl(params.projectId),
      ctaLabel: 'Sign agreement',
      textBody: `${signerLabel} signed "${params.addendumTitle}" for ${params.projectTitle}.`,
    });
  }

  async notifyContractAddendumFullySigned(params: {
    clientUserId: string;
    contractorUserId: string;
    projectId: string;
    projectTitle: string;
    addendumTitle: string;
  }): Promise<void> {
    const payload = {
      projectId: params.projectId,
      subject: `Additional agreement active — ${params.projectTitle}`,
      title: 'Additional agreement fully signed',
      bodyHtml: `<p>Both parties signed <strong>${escapeHtml(params.addendumTitle)}</strong> for <strong>${escapeHtml(params.projectTitle)}</strong>.</p>`,
      textBody: `Additional agreement "${params.addendumTitle}" is fully signed for ${params.projectTitle}.`,
    };

    await Promise.all([
      this.createInAppNotification({
        userId: params.clientUserId,
        kind: InAppNotificationKind.contract_addendum_fully_signed,
        href: this.projectPath(params.projectId),
        projectId: params.projectId,
        payload: {
          projectTitle: params.projectTitle,
          addendumTitle: params.addendumTitle,
        },
      }),
      this.createInAppNotification({
        userId: params.contractorUserId,
        kind: InAppNotificationKind.contract_addendum_fully_signed,
        href: this.projectPath(params.projectId),
        projectId: params.projectId,
        payload: {
          projectTitle: params.projectTitle,
          addendumTitle: params.addendumTitle,
        },
      }),
      this.sendToUser({
        userId: params.clientUserId,
        prefFlag: 'emailClientBidActivity',
        kind: NotificationEmailKind.contract_addendum_fully_signed,
        ...payload,
        ctaHref: this.bidsUrl(params.projectId),
        ctaLabel: 'View project',
      }),
      this.sendToUser({
        userId: params.contractorUserId,
        prefFlag: 'emailContractorUpdates',
        kind: NotificationEmailKind.contract_addendum_fully_signed,
        ...payload,
        ctaHref: this.projectUrl(params.projectId),
        ctaLabel: 'Open project',
      }),
    ]);
  }

  /**
   * Ops email: ask admin to invoice the contractor for the full 2% platform fee.
   * Recipients come from admin Settings (contract-signed notify list).
   */
  async notifyAdminPlatformFeeInvoice(params: {
    projectId: string;
    projectTitle: string;
    contractorCompanyName: string | null;
    contractorEmail: string | null;
    contractAmount: number | null;
    currency: string;
    feeAmount: number | null;
  }): Promise<void> {
    if (!this.mail.isConfigured()) {
      return;
    }

    const recipients =
      await this.platformSettings.resolveContractSignedNotifyEmails();
    if (recipients.length === 0) {
      this.logger.warn(
        'No contract-signed notify emails configured — skipping invoice request email',
      );
      return;
    }

    const company =
      params.contractorCompanyName?.trim() || 'Contractor (name not set)';
    const currency = (params.currency || 'THB').toUpperCase();
    const amountLabel =
      params.contractAmount != null
        ? `${params.contractAmount.toLocaleString('en-US')} ${currency}`
        : 'not available';
    const feeLabel =
      params.feeAmount != null
        ? `${params.feeAmount.toLocaleString('en-US')} ${currency}`
        : `2% of contract amount`;
    const contractorEmailLabel = params.contractorEmail?.trim() || 'not available';
    const projectHref = this.projectUrl(params.projectId);

    const title = 'Invoice contractor — platform fee 2%';
    const bodyHtml = [
      `<p>The contract for <strong>${escapeHtml(params.projectTitle)}</strong> is fully signed by both parties.</p>`,
      `<p>Please issue an invoice to the contractor for the <strong>full platform success fee (2%)</strong>:</p>`,
      `<ul>`,
      `<li><strong>Contractor:</strong> ${escapeHtml(company)}</li>`,
      `<li><strong>Contractor email:</strong> ${escapeHtml(contractorEmailLabel)}</li>`,
      `<li><strong>Contract amount:</strong> ${escapeHtml(amountLabel)}</li>`,
      `<li><strong>Platform fee (2%):</strong> ${escapeHtml(feeLabel)}</li>`,
      `</ul>`,
      `<p>Open the project to review details and prepare the invoice.</p>`,
    ].join('');

    const html = this.wrapEmail(
      title,
      bodyHtml,
      projectHref,
      'Open project',
    );
    const textBody = [
      `Contract fully signed: ${params.projectTitle}`,
      `Contractor: ${company}`,
      `Contractor email: ${contractorEmailLabel}`,
      `Contract amount: ${amountLabel}`,
      `Platform fee (2%): ${feeLabel}`,
      `Project: ${projectHref}`,
    ].join('\n');

    const sent = await this.mail.send({
      to: recipients,
      subject: `Platform fee invoice — ${params.projectTitle}`,
      html,
      text: `${title}\n\n${textBody}`,
    });

    if (!sent) {
      this.logger.warn(
        `Failed to send platform fee invoice email for project ${params.projectId}`,
      );
    }
  }

  async notifyContractDocumentUpdated(params: {
    recipientUserId: string;
    recipientRole: 'client' | 'contractor';
    editorRole: 'client' | 'contractor';
    projectId: string;
    projectTitle: string;
  }): Promise<void> {
    const editorLabel =
      params.editorRole === 'client' ? 'The client' : 'The contractor';
    const prefFlag =
      params.recipientRole === 'client'
        ? 'emailClientBidActivity'
        : 'emailContractorUpdates';

    await this.createInAppNotification({
      userId: params.recipientUserId,
      kind: InAppNotificationKind.contract_terms_updated,
      href: this.projectPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        changeKind: 'document',
        editorRole: params.editorRole,
      },
    });

    await this.sendToUser({
      userId: params.recipientUserId,
      prefFlag,
      kind: NotificationEmailKind.contract_terms_updated,
      projectId: params.projectId,
      subject: `Contract document updated — ${params.projectTitle}`,
      title: 'Contract document was updated',
      bodyHtml: `<p>${editorLabel} updated the English contract document for <strong>${escapeHtml(params.projectTitle)}</strong> before signing.</p><p>Open the project, review the contract editor, and continue signing when you are ready.</p>`,
      ctaHref: this.projectUrl(params.projectId),
      ctaLabel: 'View project',
      textBody: `${editorLabel} updated the contract document for ${params.projectTitle}.`,
    });
  }

  async notifyCustomContractFileUpdated(params: {
    recipientUserId: string;
    recipientRole: 'client' | 'contractor';
    editorRole: 'client' | 'contractor';
    projectId: string;
    projectTitle: string;
  }): Promise<void> {
    const editorLabel =
      params.editorRole === 'client' ? 'The client' : 'The contractor';
    const prefFlag =
      params.recipientRole === 'client'
        ? 'emailClientBidActivity'
        : 'emailContractorUpdates';

    await this.createInAppNotification({
      userId: params.recipientUserId,
      kind: InAppNotificationKind.contract_terms_updated,
      href: this.projectPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        changeKind: 'custom_file',
        editorRole: params.editorRole,
      },
    });

    await this.sendToUser({
      userId: params.recipientUserId,
      prefFlag,
      kind: NotificationEmailKind.contract_terms_updated,
      projectId: params.projectId,
      subject: `Custom contract file updated — ${params.projectTitle}`,
      title: 'Custom contract file was uploaded',
      bodyHtml: `<p>${editorLabel} uploaded a custom contract file for <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>Any previous signatures were cleared. Download the file, review it, and sign again when you are ready.</p>`,
      ctaHref: this.projectUrl(params.projectId),
      ctaLabel: 'View project',
      textBody: `${editorLabel} uploaded a custom contract file for ${params.projectTitle}. Previous signatures were cleared.`,
    });
  }

  async notifyContractTermsUpdated(params: {
    recipientUserId: string;
    recipientRole: 'client' | 'contractor';
    editorRole: 'client' | 'contractor';
    projectId: string;
    projectTitle: string;
  }): Promise<void> {
    const editorLabel =
      params.editorRole === 'client' ? 'The client' : 'The contractor';
    const prefFlag =
      params.recipientRole === 'client'
        ? 'emailClientBidActivity'
        : 'emailContractorUpdates';

    await this.sendToUser({
      userId: params.recipientUserId,
      prefFlag,
      kind: NotificationEmailKind.contract_terms_updated,
      projectId: params.projectId,
      subject: `Contract draft updated — ${params.projectTitle}`,
      title: 'Contract draft was updated',
      bodyHtml: `<p>${editorLabel} updated the commercial proposal / contract draft for <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>Review the changes and adjust your terms if needed before signing.</p>`,
      ctaHref:
        params.recipientRole === 'client'
          ? this.bidsUrl(params.projectId)
          : this.projectUrl(params.projectId),
      ctaLabel:
        params.recipientRole === 'client' ? 'Review applications' : 'View project',
      textBody: `${editorLabel} updated the contract draft for ${params.projectTitle}.`,
    });
  }

  async notifyTenderResumed(params: {
    contractorUserIds: string[];
    projectId: string;
    projectTitle: string;
    district?: string | null;
  }): Promise<void> {
    const uniqueUserIds = [...new Set(params.contractorUserIds)];
    if (uniqueUserIds.length === 0) return;

    const locationPart = params.district
      ? ` in ${escapeHtml(params.district)}`
      : '';

    for (const userId of uniqueUserIds) {
      await this.sendToUser({
        userId,
        prefFlag: 'emailContractorUpdates',
        kind: NotificationEmailKind.tender_resumed,
        projectId: params.projectId,
        subject: `Tender reopened — ${params.projectTitle}`,
        title: 'Tender is open again',
        bodyHtml: `<p>Contract negotiations for <strong>${escapeHtml(params.projectTitle)}</strong>${locationPart} ended without a signed agreement. The tender is open again — you can review the project and update your proposal.</p>`,
        ctaHref: this.projectUrl(params.projectId),
        ctaLabel: 'View project',
        textBody: `Tender reopened for ${params.projectTitle}. Contract was not signed.`,
      });
    }
  }

  async notifyClientContractorWithdrewAward(params: {
    clientUserId: string;
    projectId: string;
    projectTitle: string;
    companyName: string;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.clientUserId,
      prefFlag: 'emailClientBidActivity',
      kind: NotificationEmailKind.client_contractor_withdrew_award,
      projectId: params.projectId,
      subject: `Contractor withdrew — ${params.projectTitle}`,
      title: 'Selected contractor withdrew',
      bodyHtml: `<p><strong>${escapeHtml(params.companyName)}</strong> withdrew before signing the contract for <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>The tender is open again. Other participants have been notified.</p>`,
      ctaHref: this.bidsUrl(params.projectId),
      ctaLabel: 'Review applications',
      textBody: `${params.companyName} withdrew from ${params.projectTitle}. The tender is open again.`,
    });
  }

  async notifyClientContractorDeclinedProposal(params: {
    clientId: string;
    projectId: string;
    projectTitle: string;
    companyName: string;
    reasonCode: string;
    reasonNote: string | null;
  }): Promise<void> {
    const reasonLabel = this.formatDeclineReasonLabel(
      params.reasonCode,
      params.reasonNote,
    );
    await this.createInAppNotification({
      userId: params.clientId,
      kind: InAppNotificationKind.client_contractor_declined_proposal,
      href: this.bidsPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        companyName: params.companyName,
        reason: reasonLabel,
      },
    });
    await this.sendToUser({
      userId: params.clientId,
      prefFlag: 'emailClientBidActivity',
      kind: NotificationEmailKind.client_contractor_declined_proposal,
      projectId: params.projectId,
      subject: `Contractor declined to propose — ${params.projectTitle}`,
      title: 'Contractor declined to submit a proposal',
      bodyHtml: `<p><strong>${escapeHtml(params.companyName)}</strong> declined to submit a commercial proposal on <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>Reason: <strong>${escapeHtml(reasonLabel)}</strong></p>`,
      ctaHref: this.bidsUrl(params.projectId),
      ctaLabel: 'View applications',
      textBody: `${params.companyName} declined to submit a proposal on ${params.projectTitle}. Reason: ${reasonLabel}`,
    });
  }

  private formatDeclineReasonLabel(
    reasonCode: string,
    reasonNote: string | null,
  ): string {
    const labels: Record<string, string> = {
      specialization_mismatch:
        'The scope does not match the contractor’s specialization',
      incomplete_information:
        'Client information is incomplete and does not allow a commercial proposal',
      capacity_insufficient:
        'Contractor capacity is insufficient for the required timeline',
      commercial_terms_unacceptable:
        'Client commercial terms cannot be accepted',
      other: reasonNote?.trim() || 'Other reason',
    };
    if (reasonCode === 'other' && reasonNote?.trim()) {
      return reasonNote.trim();
    }
    return labels[reasonCode] ?? reasonCode;
  }

  async notifyContractorAwardReleased(params: {
    contractorUserId: string;
    projectId: string;
    projectTitle: string;
  }): Promise<void> {
    await this.sendToUser({
      userId: params.contractorUserId,
      prefFlag: 'emailContractorUpdates',
      kind: NotificationEmailKind.contractor_award_released,
      projectId: params.projectId,
      subject: `Award released — ${params.projectTitle}`,
      title: 'Client returned the project to tender',
      bodyHtml: `<p>The client released your selection for <strong>${escapeHtml(params.projectTitle)}</strong> before the contract was fully signed.</p><p>The project is back in the tender phase.</p>`,
      ctaHref: this.appUrl(),
      ctaLabel: 'Browse projects',
      textBody: `The client released your selection for ${params.projectTitle} before signing.`,
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

  /**
   * When a tender opens for commercial proposals, email every contractor/designer
   * whose region, locations, project type, and tags match the project — not only
   * those already enrolled from the clarification phase.
   */
  async notifyMatchingContractorsTenderOpened(
    projectId: string,
  ): Promise<void> {
    if (!this.mail.isConfigured()) return;

    const loaded = await this.loadMatchingContractorsForProject(projectId);
    if (!loaded) return;

    const { project, tender, contractors } = loaded;
    if (tender.status !== TenderStatus.open) return;

    const bids = await this.prisma.bid.findMany({
      where: {
        tenderId: tender.id,
        contractorId: { in: contractors.map((row) => row.id) },
        status: { not: BidStatus.withdrawn },
      },
      select: { contractorId: true, status: true },
    });
    const bidStatusByContractor = new Map(
      bids.map((bid) => [bid.contractorId, bid.status]),
    );

    const locationPart = project.district
      ? ` in ${escapeHtml(project.district)}`
      : '';
    const { summaryBlock, summaryText } = this.clarificationSummaryBlocks(
      project.clarificationSummary,
    );

    let notifiedCount = 0;

    for (const contractor of contractors) {
      if (await this.hasSentTenderOpenedEmail(contractor.userId, projectId)) {
        continue;
      }

      const { user, ok } = await this.shouldSendTenderOpened(contractor.userId);
      if (!ok) continue;

      const bidStatus = bidStatusByContractor.get(contractor.id);
      const isEnrolledContender =
        bidStatus === BidStatus.enrolled ||
        bidStatus === BidStatus.submitted ||
        bidStatus === BidStatus.selected;

      let bodyHtml: string;
      let textBody: string;
      if (isEnrolledContender) {
        bodyHtml = `<p>The client opened <strong>${escapeHtml(project.title)}</strong>${locationPart} for commercial proposals. You are enrolled as a contender and can submit your proposal.</p>${summaryBlock}`;
        textBody = `Tender open for bids: ${project.title}. You are enrolled as a contender.${summaryText}`;
      } else if (bidStatus === BidStatus.clarifying) {
        bodyHtml = `<p>The client opened <strong>${escapeHtml(project.title)}</strong>${locationPart} for commercial proposals. You started on this project during clarification — review the brief and submit your commercial proposal.</p>${summaryBlock}`;
        textBody = `Tender open for bids: ${project.title}. Submit your commercial proposal.${summaryText}`;
      } else {
        bodyHtml = `<p>The client opened <strong>${escapeHtml(project.title)}</strong>${locationPart} for commercial proposals. This project matches your region and specialties — apply and submit your proposal.</p>${summaryBlock}`;
        textBody = `Tender open for bids: ${project.title}. This project matches your profile.${summaryText}`;
      }

      const sent = await this.sendTenderOpenedEmail({
        userId: contractor.userId,
        user,
        projectId,
        subject: `Tender open for bids — ${project.title}`,
        title: 'Tender open for commercial proposals',
        bodyHtml,
        textBody,
      });
      if (sent) notifiedCount += 1;
    }

    this.logger.log(
      `Tender opened notifications for ${projectId}: sent ${notifiedCount} to matching contractors`,
    );
  }

  async notifyMatchingContractorsForProject(projectId: string): Promise<void> {
    if (!this.mail.isConfigured()) return;

    const loaded = await this.loadMatchingContractorsForProject(projectId);
    if (!loaded) return;

    const { project, tender, contractors } = loaded;
    const isClarificationPhase = tender.status === TenderStatus.draft;
    let notifiedCount = 0;

    for (const contractor of contractors) {
      const existingBid = await this.prisma.bid.findFirst({
        where: {
          tenderId: tender.id,
          contractorId: contractor.id,
          status: { not: BidStatus.withdrawn },
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

      const locationPart = project.district
        ? ` in ${escapeHtml(project.district)}`
        : '';

      await this.sendToUser({
        userId: contractor.userId,
        prefFlag: 'emailMatchingProjects',
        kind: NotificationEmailKind.contractor_matching_project,
        projectId,
        subject: isClarificationPhase
          ? `New project for clarification — ${project.title}`
          : `New project: ${project.title}`,
        title: isClarificationPhase
          ? 'New project open for clarification'
          : 'New project matching your specialties',
        bodyHtml: isClarificationPhase
          ? `<p>A new project <strong>${escapeHtml(project.title)}</strong>${locationPart} is open for clarification questions. Review the brief and ask anything you need before commercial proposals open.</p>`
          : `<p>A new project <strong>${escapeHtml(project.title)}</strong>${locationPart} is open for bids and matches your profile.</p>`,
        ctaHref: this.projectUrl(projectId),
        ctaLabel: 'View project',
        textBody: isClarificationPhase
          ? `New project for clarification: ${project.title}.`
          : `New matching project: ${project.title}.`,
      });
      notifiedCount += 1;
    }

    this.logger.log(
      `Matching project notifications for ${projectId}: sent ${notifiedCount} (tender ${tender.status})`,
    );
  }

  /**
   * Admin ops: new contractor signature / fee authorization request.
   * Email → contract-signed notify list; in-app → users whose email is on that list.
   */
  async notifyAdminSignatureRequestCreated(params: {
    requestId: string;
    projectId: string;
    projectTitle: string;
    companyName: string | null;
    contractorEmail: string | null;
    bankName: string | null;
    bankAccount: string | null;
    currency: string;
    contractAmount: number | null;
    dueNowListed: number | null;
    dueNowPayable: number;
    trialActive: boolean;
  }): Promise<void> {
    const company =
      params.companyName?.trim() || 'Contractor (name not set)';
    const currency = (params.currency || 'THB').toUpperCase();
    const amountLabel =
      params.contractAmount != null
        ? `${params.contractAmount.toLocaleString('en-US')} ${currency}`
        : 'not available';
    const dueListed =
      params.dueNowListed != null
        ? `${params.dueNowListed.toLocaleString('en-US')} ${currency}`
        : 'not available';
    const duePayable = params.trialActive
      ? `0 ${currency} (trial)`
      : `${params.dueNowPayable.toLocaleString('en-US')} ${currency}`;
    const adminHref = `/admin/signature-requests`;
    const adminUrl = `${this.appUrl()}${adminHref}`;

    const recipients =
      await this.platformSettings.resolveContractSignedNotifyEmails();
    if (recipients.length > 0 && this.mail.isConfigured()) {
      const title = 'Signature authorization request';
      const bodyHtml = [
        `<p>The contractor requested authorization to sign the contract for <strong>${escapeHtml(params.projectTitle)}</strong>.</p>`,
        `<ul>`,
        `<li><strong>Contractor:</strong> ${escapeHtml(company)}</li>`,
        `<li><strong>Email:</strong> ${escapeHtml(params.contractorEmail?.trim() || 'not available')}</li>`,
        `<li><strong>Bank:</strong> ${escapeHtml(params.bankName?.trim() || '—')} / ${escapeHtml(params.bankAccount?.trim() || '—')}</li>`,
        `<li><strong>Contract amount:</strong> ${escapeHtml(amountLabel)}</li>`,
        `<li><strong>Listed due now:</strong> ${escapeHtml(dueListed)}</li>`,
        `<li><strong>Payable now:</strong> ${escapeHtml(duePayable)}</li>`,
        `</ul>`,
        `<p>Review and approve or reject in Admin → Signature requests.</p>`,
      ].join('');
      const html = this.wrapEmail(title, bodyHtml, adminUrl, 'Open signature requests');
      await this.mail.send({
        to: recipients,
        subject: `Signature request — ${params.projectTitle}`,
        html,
        text: [
          title,
          `Project: ${params.projectTitle}`,
          `Contractor: ${company}`,
          `Bank: ${params.bankName ?? '—'} / ${params.bankAccount ?? '—'}`,
          `Due now: ${dueListed} (payable ${duePayable})`,
          adminUrl,
        ].join('\n'),
      });
    }

    if (recipients.length > 0) {
      const adminUsers = await this.prisma.user.findMany({
        where: {
          email: {
            in: recipients,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });
      await Promise.all(
        adminUsers.map((user) =>
          this.createInAppNotification({
            userId: user.id,
            kind: InAppNotificationKind.admin_signature_request_created,
            href: adminHref,
            projectId: params.projectId,
            payload: {
              projectTitle: params.projectTitle,
              companyName: company,
              requestId: params.requestId,
            },
          }),
        ),
      );
    }
  }

  async notifyContractorSignatureRequestDecision(params: {
    contractorUserId: string;
    projectId: string;
    projectTitle: string;
    approved: boolean;
    rejectionReason?: string | null;
  }): Promise<void> {
    const kind = params.approved
      ? InAppNotificationKind.contractor_signature_request_approved
      : InAppNotificationKind.contractor_signature_request_rejected;
    const emailKind = params.approved
      ? NotificationEmailKind.contractor_signature_request_approved
      : NotificationEmailKind.contractor_signature_request_rejected;

    await this.createInAppNotification({
      userId: params.contractorUserId,
      kind,
      href: this.projectPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        rejectionReason: params.rejectionReason?.trim() || null,
      },
    });

    const reason = params.rejectionReason?.trim();
    await this.sendToUser({
      userId: params.contractorUserId,
      prefFlag: 'emailContractorUpdates',
      kind: emailKind,
      projectId: params.projectId,
      subject: params.approved
        ? `Signature authorized — ${params.projectTitle}`
        : `Signature request rejected — ${params.projectTitle}`,
      title: params.approved
        ? 'You can sign the contract'
        : 'Signature request was rejected',
      bodyHtml: params.approved
        ? `<p>Your signature authorization for <strong>${escapeHtml(params.projectTitle)}</strong> was approved. Open the project and sign the contract.</p>`
        : `<p>Your signature authorization for <strong>${escapeHtml(params.projectTitle)}</strong> was rejected.</p>${
            reason
              ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
              : ''
          }<p>Update your details if needed and submit a new request.</p>`,
      ctaHref: this.projectUrl(params.projectId),
      ctaLabel: 'Open project',
      textBody: params.approved
        ? `Signature authorized for ${params.projectTitle}. You can sign the contract.`
        : `Signature request rejected for ${params.projectTitle}.${reason ? ` Reason: ${reason}` : ''}`,
    });
  }

  async notifyClientProgressClaimSubmitted(params: {
    clientUserId: string;
    projectId: string;
    projectTitle: string;
    companyName: string;
    amount: number;
    sequenceNumber: number;
  }): Promise<void> {
    const amountLabel = `${this.formatThbAmount(params.amount)} THB`;
    await this.createInAppNotification({
      userId: params.clientUserId,
      kind: InAppNotificationKind.client_progress_claim_submitted,
      href: this.progressClaimsPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        companyName: params.companyName,
        amount: params.amount,
        sequenceNumber: params.sequenceNumber,
      },
    });
    await this.sendToUser({
      userId: params.clientUserId,
      prefFlag: 'emailClientBidActivity',
      kind: NotificationEmailKind.client_progress_claim_submitted,
      projectId: params.projectId,
      subject: `Progress claim submitted — ${params.projectTitle}`,
      title: 'Progress claim awaiting approval',
      bodyHtml: `<p><strong>${escapeHtml(params.companyName)}</strong> submitted progress claim <strong>#${params.sequenceNumber}</strong> on <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>Amount due this period: <strong>${escapeHtml(amountLabel)}</strong></p><p>Review the claim and approve or reject it on the project page.</p>`,
      ctaHref: this.progressClaimsUrl(params.projectId),
      ctaLabel: 'Review progress claim',
      textBody: `${params.companyName} submitted progress claim #${params.sequenceNumber} on ${params.projectTitle} (${amountLabel}). Review and approve or reject on the project page.`,
    });
  }

  async notifyContractorProgressClaimApproved(params: {
    contractorUserId: string;
    projectId: string;
    projectTitle: string;
    amount: number;
    sequenceNumber: number;
  }): Promise<void> {
    const amountLabel = `${this.formatThbAmount(params.amount)} THB`;
    await this.createInAppNotification({
      userId: params.contractorUserId,
      kind: InAppNotificationKind.contractor_progress_claim_approved,
      href: this.progressClaimsPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        amount: params.amount,
        sequenceNumber: params.sequenceNumber,
      },
    });
    await this.sendToUser({
      userId: params.contractorUserId,
      prefFlag: 'emailContractorUpdates',
      kind: NotificationEmailKind.contractor_progress_claim_approved,
      projectId: params.projectId,
      subject: `Progress claim approved — ${params.projectTitle}`,
      title: 'Progress claim approved',
      bodyHtml: `<p>The client approved progress claim <strong>#${params.sequenceNumber}</strong> on <strong>${escapeHtml(params.projectTitle)}</strong>.</p><p>Approved amount this period: <strong>${escapeHtml(amountLabel)}</strong></p>`,
      ctaHref: this.progressClaimsUrl(params.projectId),
      ctaLabel: 'View progress claims',
      textBody: `Progress claim #${params.sequenceNumber} on ${params.projectTitle} was approved (${amountLabel}).`,
    });
  }

  async notifyContractorProgressClaimRejected(params: {
    contractorUserId: string;
    projectId: string;
    projectTitle: string;
    sequenceNumber: number;
    reason?: string | null;
  }): Promise<void> {
    const reason = params.reason?.trim();
    await this.createInAppNotification({
      userId: params.contractorUserId,
      kind: InAppNotificationKind.contractor_progress_claim_rejected,
      href: this.progressClaimsPath(params.projectId),
      projectId: params.projectId,
      payload: {
        projectTitle: params.projectTitle,
        sequenceNumber: params.sequenceNumber,
        reason: params.reason ?? null,
      },
    });
    await this.sendToUser({
      userId: params.contractorUserId,
      prefFlag: 'emailContractorUpdates',
      kind: NotificationEmailKind.contractor_progress_claim_rejected,
      projectId: params.projectId,
      subject: `Progress claim rejected — ${params.projectTitle}`,
      title: 'Progress claim rejected',
      bodyHtml: `<p>The client rejected progress claim <strong>#${params.sequenceNumber}</strong> on <strong>${escapeHtml(params.projectTitle)}</strong>.</p>${
        reason
          ? `<p style="background:#f8fafc;padding:12px;border-radius:8px;white-space:pre-wrap;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
          : ''
      }<p>Update the claim and submit again when ready.</p>`,
      ctaHref: this.progressClaimsUrl(params.projectId),
      ctaLabel: 'View progress claims',
      textBody: `Progress claim #${params.sequenceNumber} on ${params.projectTitle} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
    });
  }

  dispatch(promise: Promise<void>): void {
    void promise.catch((error) => {
      this.logger.warn('Notification dispatch failed', error);
    });
  }
}
