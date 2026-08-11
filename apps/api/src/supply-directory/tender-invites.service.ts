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

    const { tender, project } = await this.assertCanInvite(
      actorId,
      projectId,
      options?.isAdmin === true,
    );

    const entries = await this.prisma.supplyDirectoryEntry.findMany({
      where: { id: { in: entryIds }, isActive: true },
    });
    if (entries.length === 0) {
      throw new NotFoundException('No active directory entries found');
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
      include: {
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
    if (
      project.status === ProjectStatus.awarded ||
      project.tender?.awardedBidId
    ) {
      throw new BadRequestException(
        'Invites are not available after a contractor has been selected',
      );
    }
    if (
      (project.status !== ProjectStatus.in_tender &&
        project.status !== ProjectStatus.clarification) ||
      !project.tender
    ) {
      throw new BadRequestException(
        'Invites are only available while the tender is open',
      );
    }
    if (
      project.tender.status !== TenderStatus.open &&
      project.tender.status !== TenderStatus.draft
    ) {
      throw new BadRequestException(
        'Invites are only available during tender publication or clarification',
      );
    }
    return { project, tender: project.tender };
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
    const subject = `Invitation to participate in tender: ${params.projectTitle}`;
    const text = [
      greeting,
      '',
      `You are invited to review a project on BuilTHAI and consider participating as a ${roleLabel}.`,
      '',
      `Project: ${params.projectTitle}`,
      `Open the project card: ${params.inviteUrl}`,
      '',
      'You can view the project without registering. To submit a commercial proposal, please create an account and sign in.',
      '',
      '— BuilTHAI',
    ].join('\n');

    const html = `
      <p>${escapeHtml(greeting)}</p>
      <p>You are invited to review a project on <strong>BuilTHAI</strong> and consider participating as a ${escapeHtml(roleLabel)}.</p>
      <p><strong>Project:</strong> ${escapeHtml(params.projectTitle)}</p>
      <p><a href="${escapeHtml(params.inviteUrl)}">Open the project card</a></p>
      <p>You can view the project without registering. To submit a commercial proposal, please create an account and sign in.</p>
      <p>— BuilTHAI</p>
    `;

    return this.mail.send({
      to: params.to,
      subject,
      text,
      html,
    });
  }
}
