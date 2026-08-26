import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProjectStatus,
  ProjectType,
  SupplyDirectoryKind,
  TenderStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../notifications/mail.service';
import { resolveAppBaseUrl } from '../common/app-base-url';
import { PrismaService } from '../prisma/prisma.service';
import {
  InviteDirectoryRecipientsDto,
  InviteManualRecipientDto,
  TenderInviteResultDto,
} from './supply-directory.types';

const INVITE_TTL_DAYS = 60;

/** Per-kind caps for non-admin (client) registry invites in one send. */
const CLIENT_DIRECTORY_INVITE_MAX_BY_KIND: Record<SupplyDirectoryKind, number> =
  {
    designer: 3,
    contractor: 4,
    supplier: 3,
  };

/** Admin still capped — uncapped blasts hurt SMTP reputation. */
const ADMIN_DIRECTORY_INVITE_MAX_BY_KIND: Record<SupplyDirectoryKind, number> =
  {
    designer: 10,
    contractor: 15,
    supplier: 10,
  };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class TenderInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private appUrl(): string {
    return resolveAppBaseUrl((key) => this.config.get<string>(key));
  }

  inviteProjectUrl(projectId: string, token: string): string {
    return `${this.appUrl()}/projects/${projectId}?invite=${encodeURIComponent(token)}`;
  }

  async assertValidInviteToken(
    projectId: string,
    rawToken: string | null | undefined,
  ): Promise<boolean> {
    const token = rawToken?.trim();
    if (!token) return false;

    const invite = await this.prisma.tenderInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        projectId: true,
        expiresAt: true,
        openedAt: true,
        tender: { select: { status: true } },
      },
    });

    if (!invite || invite.projectId !== projectId) {
      return false;
    }
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      return false;
    }
    if (
      invite.tender.status !== TenderStatus.open &&
      invite.tender.status !== TenderStatus.draft
    ) {
      return false;
    }

    if (!invite.openedAt) {
      await this.prisma.tenderInvite.update({
        where: { id: invite.id },
        data: { openedAt: new Date() },
      });
    }

    return true;
  }

  /**
   * Emails that belong to a registered supply-side account
   * (contractor/designer profile) — they already get matching-project mail.
   */
  async registeredSupplyEmails(emails: string[]): Promise<Set<string>> {
    const normalized = [
      ...new Set(emails.map(normalizeEmail).filter((e) => e.includes('@'))),
    ];
    if (normalized.length === 0) return new Set();

    const users = await this.prisma.user.findMany({
      where: {
        email: { in: normalized, mode: 'insensitive' },
        contractorProfile: { isNot: null },
      },
      select: { email: true },
    });

    return new Set(
      users
        .map((u) => u.email)
        .filter((e): e is string => Boolean(e))
        .map(normalizeEmail),
    );
  }

  async inviteFromDirectory(
    actorId: string,
    projectId: string,
    dto: InviteDirectoryRecipientsDto,
    options?: { isAdmin?: boolean },
  ): Promise<TenderInviteResultDto[]> {
    const entryIds = [
      ...new Set((dto.entryIds ?? []).map((id) => id.trim()).filter(Boolean)),
    ];
    if (entryIds.length === 0) {
      throw new BadRequestException('Select at least one directory entry');
    }
    const isAdmin = options?.isAdmin === true;

    const { tender, project } = await this.assertCanInvite(
      actorId,
      projectId,
      isAdmin,
    );

    const entries = await this.prisma.supplyDirectoryEntry.findMany({
      where: { id: { in: entryIds } },
    });
    if (entries.length === 0) {
      throw new NotFoundException('No directory entries found');
    }

    const caps = isAdmin
      ? ADMIN_DIRECTORY_INVITE_MAX_BY_KIND
      : CLIENT_DIRECTORY_INVITE_MAX_BY_KIND;
    const counts: Partial<Record<SupplyDirectoryKind, number>> = {};
    for (const entry of entries) {
      counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
    }
    for (const kind of Object.values(SupplyDirectoryKind)) {
      const count = counts[kind] ?? 0;
      const max = caps[kind];
      if (count > max) {
        throw new BadRequestException(
          `Select at most ${max} ${kind} entries from the registry`,
        );
      }
    }

    const registered = await this.registeredSupplyEmails(
      entries.map((e) => e.email),
    );

    const results: TenderInviteResultDto[] = [];
    for (const entry of entries) {
      if (registered.has(normalizeEmail(entry.email))) {
        continue;
      }
      results.push(
        await this.createAndSendInvite({
          tenderId: tender.id,
          projectId: project.id,
          projectTitle: project.title,
          invitedById: actorId,
          kind: entry.kind,
          recipientEmail: entry.email,
          recipientName: entry.contactName ?? entry.companyName,
          directoryEntryId: entry.id,
        }),
      );
    }

    if (results.length === 0) {
      throw new BadRequestException(
        'All selected recipients are already registered on BuilTHAI',
      );
    }

    return results;
  }

  async inviteManual(
    actorId: string,
    projectId: string,
    dto: InviteManualRecipientDto,
    options?: { isAdmin?: boolean },
  ): Promise<TenderInviteResultDto> {
    const email = normalizeEmail(dto.email ?? '');
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    if (!Object.values(SupplyDirectoryKind).includes(dto.kind)) {
      throw new BadRequestException('Invalid invite kind');
    }

    const registered = await this.registeredSupplyEmails([email]);
    if (registered.has(email)) {
      throw new BadRequestException(
        'This email belongs to a registered contractor or designer who already receives project notifications',
      );
    }

    const { tender, project } = await this.assertCanInvite(
      actorId,
      projectId,
      options?.isAdmin === true,
    );

    return this.createAndSendInvite({
      tenderId: tender.id,
      projectId: project.id,
      projectTitle: project.title,
      invitedById: actorId,
      kind: dto.kind,
      recipientEmail: email,
      recipientName: dto.name?.trim() || null,
      directoryEntryId: null,
    });
  }

  suggestedKindForProject(projectType: ProjectType): SupplyDirectoryKind {
    return projectType === ProjectType.design
      ? SupplyDirectoryKind.designer
      : SupplyDirectoryKind.contractor;
  }

  private async assertCanInvite(
    actorId: string,
    projectId: string,
    isAdmin: boolean,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        status: true,
        clientId: true,
        clarificationMode: true,
        tender: { select: { id: true, status: true, awardedBidId: true } },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (!isAdmin && project.clientId !== actorId) {
      throw new ForbiddenException(
        'Only the project owner or an admin can send invites',
      );
    }

    let tender = project.tender;
    if (
      project.status === ProjectStatus.awarded ||
      tender?.awardedBidId
    ) {
      throw new BadRequestException(
        'Invites are not available after a contractor has been selected',
      );
    }

    const inviteEligibleStatus =
      project.status === ProjectStatus.in_tender ||
      project.status === ProjectStatus.clarification;

    if (!inviteEligibleStatus) {
      throw new BadRequestException(
        'Invites are only available during tender publication or clarification',
      );
    }

    // Clarification / in_tender should always have a tender row; heal if missing
    // (same recovery as TendersService.getForProject).
    if (!tender) {
      const created = await this.prisma.tender.create({
        data: {
          projectId: project.id,
          status:
            project.status === ProjectStatus.clarification
              ? TenderStatus.draft
              : TenderStatus.open,
          opensAt:
            project.status === ProjectStatus.clarification ? null : new Date(),
        },
        select: { id: true, status: true, awardedBidId: true },
      });
      tender = created;
    }

    if (
      tender.status !== TenderStatus.open &&
      tender.status !== TenderStatus.draft
    ) {
      throw new BadRequestException(
        'Invites are only available while the tender is open or in clarification',
      );
    }

    return { project, tender };
  }

  private async createAndSendInvite(params: {
    tenderId: string;
    projectId: string;
    projectTitle: string;
    invitedById: string;
    kind: SupplyDirectoryKind;
    recipientEmail: string;
    recipientName: string | null;
    directoryEntryId: string | null;
  }): Promise<TenderInviteResultDto> {
    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const invite = await this.prisma.tenderInvite.create({
      data: {
        tenderId: params.tenderId,
        projectId: params.projectId,
        directoryEntryId: params.directoryEntryId,
        invitedById: params.invitedById,
        kind: params.kind,
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    });

    const inviteUrl = this.inviteProjectUrl(params.projectId, rawToken);
    const emailSent = await this.sendInviteEmail({
      to: params.recipientEmail,
      recipientName: params.recipientName,
      projectTitle: params.projectTitle,
      inviteUrl,
      kind: params.kind,
    });

    if (emailSent) {
      await this.prisma.tenderInvite.update({
        where: { id: invite.id },
        data: { sentAt: new Date() },
      });
    }

    return {
      id: invite.id,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      kind: params.kind,
      emailSent,
      inviteUrl,
    };
  }

  private async sendInviteEmail(params: {
    to: string;
    recipientName: string | null;
    projectTitle: string;
    inviteUrl: string;
    kind: SupplyDirectoryKind;
  }): Promise<boolean> {
    const greeting = params.recipientName
      ? `Hello ${params.recipientName},`
      : 'Hello,';
    const roleLabel =
      params.kind === SupplyDirectoryKind.designer
        ? 'designer'
        : params.kind === SupplyDirectoryKind.supplier
          ? 'supplier'
          : 'contractor';
    const from = this.mail.outreachFrom();
    // Avoid “invitation / participate / tender” phrasing — it looks like bulk promo.
    const subject = `Project on BuilTHAI: ${params.projectTitle}`;
    const text = [
      greeting,
      '',
      `A client on BuilTHAI asked us to share a project that may match your work as a ${roleLabel}.`,
      'You were contacted because your company is in the BuilTHAI professional registry.',
      '',
      `Project: ${params.projectTitle}`,
      `Project page: ${params.inviteUrl}`,
      '',
      'You can open the page without creating an account. A BuilTHAI account is only needed if you want to submit a proposal.',
      '',
      'If this was not relevant, reply to this email and we will not contact you again.',
      '',
      'BuilTHAI · https://www.builthai.com',
      `Questions: ${from}`,
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f4fa;font-family:system-ui,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;">
<tr><td style="padding:28px;">
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#2563eb;">BuilTHAI</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">A client on BuilTHAI asked us to share a project that may match your work as a ${escapeHtml(roleLabel)}. You were contacted because your company is in the BuilTHAI professional registry.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0f172a;"><strong>Project:</strong> ${escapeHtml(params.projectTitle)}</p>
<p style="margin:0 0 8px;"><a href="${escapeHtml(params.inviteUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">Open project page</a></p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748b;word-break:break-all;">${escapeHtml(params.inviteUrl)}</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">You can open the page without creating an account. A BuilTHAI account is only needed if you want to submit a proposal.</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">If this was not relevant, reply to this email and we will not contact you again.<br>BuilTHAI · <a href="https://www.builthai.com" style="color:#64748b;">www.builthai.com</a> · ${escapeHtml(from)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

    return this.mail.send({
      to: params.to,
      subject,
      text,
      html,
      from,
      fromName: this.mail.outreachFromName(),
      replyTo: from,
      // Mailto only — One-Click Post requires a working HTTPS endpoint.
      headers: {
        'List-Unsubscribe': `<mailto:${from}?subject=unsubscribe>`,
      },
    });
  }
}
