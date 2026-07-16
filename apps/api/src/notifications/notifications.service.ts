import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationEmailKind,
  TenderStatus,
  User,
  UserNotificationPreferences,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
    private readonly locations: LocationsService,
    private readonly config: ConfigService,
    private readonly projectLocalization: ProjectLocalizationService,
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
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2563eb;text-transform:uppercase;">Ant Construction</p>
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
      bodyHtml: `<p>Your contractor verification for <strong>${escapeHtml(label)}</strong> has been approved.</p><p>You can now use verified contractor features on Ant, including portfolio visibility.</p>`,
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
          ? this.bidsUrl(params.projectId)
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

  async notifyContractorsTenderOpened(params: {
    contractorUserIds: string[];
    projectId: string;
    projectTitle: string;
    district?: string | null;
    clarificationSummary?: string | null;
  }): Promise<void> {
    const uniqueUserIds = [...new Set(params.contractorUserIds)];
    if (uniqueUserIds.length === 0) return;

    const locationPart = params.district
      ? ` in ${escapeHtml(params.district)}`
      : '';
    const summaryBlock = params.clarificationSummary?.trim()
      ? `<div style="margin-top:16px;padding:14px 16px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;">
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;">Clarification summary</p>
<p style="margin:0;font-size:14px;line-height:1.55;color:#475569;white-space:pre-wrap;">${escapeHtml(params.clarificationSummary.trim())}</p>
</div>`
      : '';
    const summaryText = params.clarificationSummary?.trim()
      ? `\n\nClarification summary:\n${params.clarificationSummary.trim()}`
      : '';

    for (const userId of uniqueUserIds) {
      await this.sendToUser({
        userId,
        prefFlag: 'emailContractorUpdates',
        kind: NotificationEmailKind.contractor_tender_opened,
        projectId: params.projectId,
        subject: `Tender open for bids — ${params.projectTitle}`,
        title: 'Tender open for commercial proposals',
        bodyHtml: `<p>The client opened <strong>${escapeHtml(params.projectTitle)}</strong>${locationPart} for commercial proposals. You are enrolled as a contender and can submit your proposal.</p>${summaryBlock}`,
        ctaHref: this.projectUrl(params.projectId),
        ctaLabel: 'View project',
        textBody: `Tender open for bids: ${params.projectTitle}. You are enrolled as a contender.${summaryText}`,
      });
    }
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
        OR: [
          { projectTypes: { isEmpty: true } },
          { projectTypes: { has: project.projectType } },
        ],
      },
      include: { user: true },
    });

    const projectLocation = {
      regionSlug: project.locationRegionSlug,
      areaSlug: project.locationAreaSlug,
    };
    const isClarificationPhase = project.tender.status === TenderStatus.draft;
    let notifiedCount = 0;

    for (const contractor of contractors) {
      const serviceLocations = this.locations.normalizeServiceLocations(
        contractor.serviceLocationsJson,
      );
      if (
        !this.locations.contractorMatchesProject(
          serviceLocations,
          projectLocation,
        )
      ) {
        continue;
      }

      if (
        !contractorProjectTypeMatches(
          contractor.projectTypes ?? [],
          project.projectType,
        )
      ) {
        continue;
      }

      if (
        !contractorTagsMatchProject(
          contractor.tagSlugs ?? [],
          projectTagSlugs,
        )
      ) {
        continue;
      }

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
      `Matching project notifications for ${projectId}: sent ${notifiedCount} (tender ${project.tender.status})`,
    );
  }

  dispatch(promise: Promise<void>): void {
    void promise.catch((error) => {
      this.logger.warn('Notification dispatch failed', error);
    });
  }
}
