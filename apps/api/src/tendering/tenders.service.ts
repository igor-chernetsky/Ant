import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Bid,
  BidStatus,
  ContractorProfile,
  ContractorVerificationStatus,
  Prisma,
  ProjectStatus,
  Tender,
  TenderInvitationStatus,
  TenderStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import { TenderAutoCloseService } from './tender-auto-close.service';
import { TenderMatchingService } from './tender-matching.service';
import {
  BidResponse,
  BidTermsV1,
  DEFAULT_TENDER_DURATION_DAYS,
  MAX_BID_APPROACH_LENGTH,
  MAX_BID_LINE_ITEMS,
  MAX_BID_NOTES_LENGTH,
  MAX_BID_SCOPE_LENGTH,
  RespondInvitationDto,
  SubmitBidDto,
  TenderInvitationResponse,
  TenderResponse,
} from './tendering.types';

type TenderWithRelations = Tender & {
  invitations: Array<
    Prisma.TenderInvitationGetPayload<{
      include: { contractor: true };
    }>
  >;
  bids: Array<
    Bid & {
      contractor: ContractorProfile;
    }
  >;
};

@Injectable()
export class TendersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: TenderMatchingService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly autoClose: TenderAutoCloseService,
  ) {}

  private mapBid(bid: Bid & { contractor: ContractorProfile }): BidResponse {
    return {
      id: bid.id,
      tenderId: bid.tenderId,
      contractorId: bid.contractorId,
      companyName: bid.contractor.companyName,
      status: bid.status,
      amount: bid.amount.toString(),
      durationDays: bid.durationDays,
      terms: (bid.termsJson as BidTermsV1 | null) ?? null,
      submittedAt: bid.submittedAt.toISOString(),
    };
  }

  private mapInvitation(
    invitation: Prisma.TenderInvitationGetPayload<{
      include: { contractor: true };
    }>,
  ): TenderInvitationResponse {
    return {
      id: invitation.id,
      contractorId: invitation.contractorId,
      companyName: invitation.contractor.companyName,
      status: invitation.status,
      invitedAt: invitation.invitedAt.toISOString(),
      respondedAt: invitation.respondedAt?.toISOString() ?? null,
    };
  }

  private mapTender(tender: TenderWithRelations): TenderResponse {
    const invitations = tender.invitations.map((i) => this.mapInvitation(i));
    const bids = tender.bids
      .filter((b) => b.status !== BidStatus.withdrawn)
      .map((b) => this.mapBid(b));

    return {
      id: tender.id,
      projectId: tender.projectId,
      status: tender.status,
      currency: tender.currency,
      minBids: tender.minBids,
      opensAt: tender.opensAt?.toISOString() ?? null,
      closesAt: tender.closesAt?.toISOString() ?? null,
      awardedBidId: tender.awardedBidId,
      invitations,
      bids,
      acceptedInvitationCount: invitations.filter(
        (i) => i.status === TenderInvitationStatus.accepted,
      ).length,
      submittedBidCount: bids.filter((b) => b.status === BidStatus.submitted)
        .length,
      createdAt: tender.createdAt.toISOString(),
      updatedAt: tender.updatedAt.toISOString(),
    };
  }

  private includeTenderRelations() {
    return {
      invitations: {
        include: { contractor: true },
        orderBy: { invitedAt: 'asc' as const },
      },
      bids: {
        include: { contractor: true },
        orderBy: { submittedAt: 'desc' as const },
      },
    };
  }

  private async loadTender(tenderId: string): Promise<TenderWithRelations> {
    await this.autoClose.closeTenderIfExpired(tenderId);

    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: this.includeTenderRelations(),
    });
    if (!tender) {
      throw new NotFoundException('Tender not found');
    }
    return tender;
  }

  private async assertProjectOwner(projectId: string, clientId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    return project;
  }

  async getForProject(
    clientId: string,
    projectId: string,
  ): Promise<TenderResponse | null> {
    await this.assertProjectOwner(projectId, clientId);
    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!tender) {
      return null;
    }
    return this.mapTender(await this.loadTender(tender.id));
  }

  async createTender(clientId: string, projectId: string): Promise<TenderResponse> {
    const project = await this.assertProjectOwner(projectId, clientId);
    this.matching.assertProjectEligibleForTender(project);

    const existing = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (existing) {
      return this.mapTender(await this.loadTender(existing.id));
    }

    const contractorIds = await this.matching.findInvitees(project, clientId);

    const tender = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tender.create({
        data: {
          projectId,
          status:
            contractorIds.length > 0
              ? TenderStatus.collecting_participants
              : TenderStatus.draft,
        },
        include: this.includeTenderRelations(),
      });

      if (contractorIds.length > 0) {
        await tx.tenderInvitation.createMany({
          data: contractorIds.map((contractorId) => ({
            tenderId: created.id,
            contractorId,
          })),
        });
      }

      if (project.status === ProjectStatus.estimated) {
        await tx.project.update({
          where: { id: projectId },
          data: { status: ProjectStatus.tender_ready },
        });
      }

      return tx.tender.findUniqueOrThrow({
        where: { id: created.id },
        include: this.includeTenderRelations(),
      });
    });

    return this.mapTender(tender);
  }

  async startTender(clientId: string, projectId: string): Promise<TenderResponse> {
    const project = await this.assertProjectOwner(projectId, clientId);
    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      include: this.includeTenderRelations(),
    });

    if (!tender) {
      throw new NotFoundException('Tender not found. Create a tender first.');
    }

    if (
      tender.status !== TenderStatus.draft &&
      tender.status !== TenderStatus.collecting_participants
    ) {
      throw new BadRequestException('Tender cannot be started in its current status');
    }

    const acceptedCount = tender.invitations.filter(
      (i) => i.status === TenderInvitationStatus.accepted,
    ).length;

    if (acceptedCount < 1) {
      throw new BadRequestException(
        'At least one contractor must accept the invitation before opening the tender',
      );
    }

    const now = new Date();
    const closesAt = new Date(now);
    closesAt.setDate(closesAt.getDate() + DEFAULT_TENDER_DURATION_DAYS);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tender.update({
        where: { id: tender.id },
        data: {
          status: TenderStatus.open,
          opensAt: now,
          closesAt,
        },
        include: this.includeTenderRelations(),
      });

      await tx.project.update({
        where: { id: project.id },
        data: { status: ProjectStatus.in_tender },
      });

      return next;
    });

    return this.mapTender(updated);
  }

  async selectBid(
    clientId: string,
    projectId: string,
    bidId: string,
  ): Promise<TenderResponse> {
    await this.assertProjectOwner(projectId, clientId);

    const tenderRef = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { id: true },
    });

    if (!tenderRef) {
      throw new NotFoundException('Tender not found');
    }

    const tender = await this.loadTender(tenderRef.id);

    if (
      tender.status !== TenderStatus.open &&
      tender.status !== TenderStatus.closed
    ) {
      throw new BadRequestException('Cannot select a bid for this tender status');
    }

    const bid = tender.bids.find((b) => b.id === bidId);
    if (!bid || bid.status !== BidStatus.submitted) {
      throw new NotFoundException('Bid not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.bid.updateMany({
        where: {
          tenderId: tender.id,
          id: { not: bidId },
          status: BidStatus.submitted,
        },
        data: { status: BidStatus.rejected },
      });

      await tx.bid.update({
        where: { id: bidId },
        data: { status: BidStatus.selected },
      });

      const nextTender = await tx.tender.update({
        where: { id: tender.id },
        data: {
          status: TenderStatus.awarded,
          awardedBidId: bidId,
        },
        include: this.includeTenderRelations(),
      });

      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.contractor_selected },
      });

      return nextTender;
    });

    return this.mapTender(updated);
  }

  async listInvitationsForContractor(userId: string) {
    const profile = await this.contractorProfiles.getByUserId(userId);
    if (!profile) {
      return [];
    }

    const invitations = await this.prisma.tenderInvitation.findMany({
      where: { contractorId: profile.id },
      include: {
        tender: {
          include: {
            project: true,
            bids: {
              where: { contractorId: profile.id },
              orderBy: { submittedAt: 'desc' },
            },
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });

    return invitations.map((inv) => {
      const activeBid =
        inv.tender.bids.find((b) => b.status !== BidStatus.withdrawn) ??
        null;

      return {
        invitationId: inv.id,
        tenderId: inv.tenderId,
        projectId: inv.tender.projectId,
        projectTitle: inv.tender.project.title,
        projectDistrict: inv.tender.project.district,
        tenderStatus: inv.tender.status,
        invitationStatus: inv.status,
        closesAt: inv.tender.closesAt?.toISOString() ?? null,
        invitedAt: inv.invitedAt.toISOString(),
        bidStatus: activeBid?.status ?? null,
        bidAmount: activeBid ? String(activeBid.amount) : null,
      };
    });
  }

  async getParticipationForProject(userId: string, projectId: string) {
    const profile = await this.contractorProfiles.getByUserId(userId);
    if (!profile) {
      return null;
    }

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      include: this.includeTenderRelations(),
    });
    if (!tender) {
      return null;
    }

    const invitation = tender.invitations.find(
      (i) => i.contractorId === profile.id,
    );
    if (!invitation) {
      return null;
    }

    const myBid =
      tender.bids.find(
        (b) =>
          b.contractorId === profile.id && b.status !== BidStatus.withdrawn,
      ) ?? null;

    const verified =
      profile.verificationStatus === ContractorVerificationStatus.verified;

    const canRespondToInvitation =
      verified &&
      invitation.status === TenderInvitationStatus.pending &&
      (tender.status === TenderStatus.draft ||
        tender.status === TenderStatus.collecting_participants);

    const canSubmitBid =
      verified &&
      invitation.status === TenderInvitationStatus.accepted &&
      tender.status === TenderStatus.open;

    return {
      tenderId: tender.id,
      invitation: this.mapInvitation(invitation),
      tenderStatus: tender.status,
      closesAt: tender.closesAt?.toISOString() ?? null,
      myBid: myBid ? this.mapBid(myBid) : null,
      verificationStatus: profile.verificationStatus,
      canRespondToInvitation,
      canSubmitBid,
    };
  }

  async respondToInvitation(
    userId: string,
    tenderId: string,
    dto: RespondInvitationDto,
  ): Promise<TenderInvitationResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    this.contractorProfiles.assertVerified(profile);

    const invitation = await this.prisma.tenderInvitation.findUnique({
      where: {
        tenderId_contractorId: {
          tenderId,
          contractorId: profile.id,
        },
      },
      include: { contractor: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== TenderInvitationStatus.pending) {
      throw new BadRequestException('Invitation already responded');
    }

    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
    });
    if (!tender) {
      throw new NotFoundException('Tender not found');
    }

    if (
      tender.status !== TenderStatus.collecting_participants &&
      tender.status !== TenderStatus.draft
    ) {
      throw new BadRequestException('Invitations are closed for this tender');
    }

    const updated = await this.prisma.tenderInvitation.update({
      where: { id: invitation.id },
      data: {
        status: dto.accept
          ? TenderInvitationStatus.accepted
          : TenderInvitationStatus.declined,
        respondedAt: new Date(),
      },
      include: { contractor: true },
    });

    return this.mapInvitation(updated);
  }

  private buildBidTerms(dto: SubmitBidDto): BidTermsV1 {
    const notes = dto.notes?.trim();
    const approach = dto.approach?.trim();
    const scopeSummary = dto.scopeSummary?.trim();

    if (notes && notes.length > MAX_BID_NOTES_LENGTH) {
      throw new BadRequestException(
        `Comment must be at most ${MAX_BID_NOTES_LENGTH} characters`,
      );
    }
    if (approach && approach.length > MAX_BID_APPROACH_LENGTH) {
      throw new BadRequestException(
        `Implementation proposal must be at most ${MAX_BID_APPROACH_LENGTH} characters`,
      );
    }
    if (scopeSummary && scopeSummary.length > MAX_BID_SCOPE_LENGTH) {
      throw new BadRequestException(
        `Scope summary must be at most ${MAX_BID_SCOPE_LENGTH} characters`,
      );
    }

    let lineItems = dto.lineItems;
    if (lineItems?.length) {
      if (lineItems.length > MAX_BID_LINE_ITEMS) {
        throw new BadRequestException(
          `At most ${MAX_BID_LINE_ITEMS} line items allowed`,
        );
      }
      lineItems = lineItems.map((item) => {
        const trade = item.trade?.trim();
        const description = item.description?.trim();
        const amount = Number(item.amount);
        if (!trade || !description) {
          throw new BadRequestException(
            'Each line item needs a trade and description',
          );
        }
        if (!Number.isFinite(amount) || amount < 0) {
          throw new BadRequestException(
            'Line item amounts must be zero or positive',
          );
        }
        return { trade, description, amount };
      });
    }

    return {
      notes: notes || undefined,
      approach: approach || undefined,
      scopeSummary: scopeSummary || undefined,
      lineItems: lineItems?.length ? lineItems : undefined,
    };
  }

  async submitBid(
    userId: string,
    tenderId: string,
    dto: SubmitBidDto,
  ): Promise<BidResponse> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Bid amount must be a positive number');
    }

    const profile = await this.contractorProfiles.requireByUserId(userId);
    this.contractorProfiles.assertVerified(profile);
    const tender = await this.loadTender(tenderId);

    if (tender.status !== TenderStatus.open) {
      throw new BadRequestException(
        tender.status === TenderStatus.closed
          ? 'Tender is closed for new bids'
          : 'Tender is not open for bids',
      );
    }

    const invitation = tender.invitations.find(
      (i) => i.contractorId === profile.id,
    );
    if (!invitation || invitation.status !== TenderInvitationStatus.accepted) {
      throw new ForbiddenException('You must accept the invitation to submit a bid');
    }

    const terms = this.buildBidTerms(dto);

    const bid = await this.prisma.bid.upsert({
      where: {
        tenderId_contractorId: {
          tenderId,
          contractorId: profile.id,
        },
      },
      create: {
        tenderId,
        contractorId: profile.id,
        amount: dto.amount,
        durationDays: dto.durationDays ?? null,
        termsJson: terms as unknown as Prisma.InputJsonValue,
        status: BidStatus.submitted,
      },
      update: {
        amount: dto.amount,
        durationDays: dto.durationDays ?? null,
        termsJson: terms as unknown as Prisma.InputJsonValue,
        status: BidStatus.submitted,
        submittedAt: new Date(),
      },
      include: { contractor: true },
    });

    return this.mapBid(bid);
  }

  async withdrawBid(userId: string, tenderId: string): Promise<BidResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);

    if (tender.status !== TenderStatus.open) {
      throw new BadRequestException('Tender is not open');
    }

    const bid = tender.bids.find(
      (b) =>
        b.contractorId === profile.id && b.status === BidStatus.submitted,
    );
    if (!bid) {
      throw new NotFoundException('No active bid to withdraw');
    }

    const updated = await this.prisma.bid.update({
      where: { id: bid.id },
      data: { status: BidStatus.withdrawn },
      include: { contractor: true },
    });

    return this.mapBid(updated);
  }

  async getTenderForContractor(userId: string, tenderId: string) {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);

    const invitation = tender.invitations.find(
      (i) => i.contractorId === profile.id,
    );
    if (!invitation) {
      throw new ForbiddenException('You are not invited to this tender');
    }

    const myBid =
      tender.bids.find(
        (b) =>
          b.contractorId === profile.id && b.status !== BidStatus.withdrawn,
      ) ?? null;

    return {
      tender: this.mapTender(tender),
      invitation: this.mapInvitation(
        tender.invitations.find((i) => i.id === invitation.id)!,
      ),
      myBid: myBid ? this.mapBid(myBid) : null,
    };
  }
}
