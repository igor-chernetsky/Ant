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
  Prisma,
  ProjectStatus,
  Tender,
  TenderStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BidMessagesService } from './bid-messages.service';
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
  SubmitBidDto,
  TenderResponse,
  ContractorApplicationItem,
} from './tendering.types';

type TenderWithRelations = Tender & {
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
    private readonly bidMessages: BidMessagesService,
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

  private mapTender(tender: TenderWithRelations): TenderResponse {
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
      bids,
      submittedBidCount: bids.filter((b) => b.status === BidStatus.submitted)
        .length,
      createdAt: tender.createdAt.toISOString(),
      updatedAt: tender.updatedAt.toISOString(),
    };
  }

  private includeTenderRelations() {
    return {
      bids: {
        include: { contractor: true },
        orderBy: { submittedAt: 'desc' as const },
      },
    };
  }

  private biddingDeadlineFrom(start: Date): Date {
    const closesAt = new Date(start);
    closesAt.setDate(closesAt.getDate() + DEFAULT_TENDER_DURATION_DAYS);
    return closesAt;
  }

  /** Keep deadline in sync with whether bidding actually started. */
  private async reconcileDormantTender(tenderId: string): Promise<void> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        bids: {
          where: { status: BidStatus.submitted },
          select: { id: true },
        },
      },
    });
    if (!tender) {
      return;
    }

    const hasSubmittedBids = tender.bids.length > 0;

    if (
      tender.status === TenderStatus.closed &&
      !hasSubmittedBids
    ) {
      await this.prisma.tender.update({
        where: { id: tenderId },
        data: {
          status: TenderStatus.open,
          closesAt: null,
        },
      });
      return;
    }

    if (
      tender.status === TenderStatus.open &&
      !hasSubmittedBids &&
      tender.closesAt
    ) {
      await this.prisma.tender.update({
        where: { id: tenderId },
        data: { closesAt: null },
      });
    }
  }

  private async loadTender(tenderId: string): Promise<TenderWithRelations> {
    await this.reconcileDormantTender(tenderId);
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
    const project = await this.assertProjectOwner(projectId, clientId);

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { id: true },
    });

    if (!tender) {
      if (project.status === ProjectStatus.in_tender) {
        return this.createTender(clientId, projectId);
      }
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

    const now = new Date();

    const tender = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tender.create({
        data: {
          projectId,
          status: TenderStatus.open,
          opensAt: now,
          closesAt: null,
        },
        include: this.includeTenderRelations(),
      });

      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.in_tender },
      });

      return created;
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

    if (tender.status === TenderStatus.open) {
      return this.mapTender(tender);
    }

    if (tender.status !== TenderStatus.draft) {
      throw new BadRequestException(
        'Tender cannot be started in its current status',
      );
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tender.update({
        where: { id: tender.id },
        data: {
          status: TenderStatus.open,
          opensAt: now,
          closesAt: null,
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

  async listApplicationsForContractor(
    userId: string,
  ): Promise<ContractorApplicationItem[]> {
    const profile = await this.contractorProfiles.getByUserId(userId);
    if (!profile) {
      return [];
    }

    const bids = await this.prisma.bid.findMany({
      where: {
        contractorId: profile.id,
        status: { not: BidStatus.withdrawn },
      },
      include: {
        tender: { include: { project: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return bids.map((bid) => ({
      bidId: bid.id,
      tenderId: bid.tenderId,
      projectId: bid.tender.projectId,
      projectTitle: bid.tender.project.title,
      projectDistrict: bid.tender.project.district,
      tenderStatus: bid.tender.status,
      bidStatus: bid.status,
      bidAmount: bid.status === BidStatus.submitted ? bid.amount.toString() : null,
      submittedAt: bid.submittedAt.toISOString(),
    }));
  }

  async listInvitationsForContractor(userId: string): Promise<unknown[]> {
    return this.listApplicationsForContractor(userId);
  }

  async getParticipationForProject(userId: string, projectId: string) {
    const profile = await this.contractorProfiles.getByUserId(userId);
    if (!profile) {
      return null;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return null;
    }

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      include: this.includeTenderRelations(),
    });

    const myBid =
      tender?.bids.find(
        (b) =>
          b.contractorId === profile.id && b.status !== BidStatus.withdrawn,
      ) ?? null;

    return {
      tenderId: tender?.id ?? null,
      tenderStatus: tender?.status ?? null,
      closesAt: tender?.closesAt?.toISOString() ?? null,
      myBid: myBid ? this.mapBid(myBid) : null,
      verificationStatus: profile.verificationStatus,
      canSubmitBid: tender?.status === TenderStatus.open,
      projectStatus: project.status,
    };
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
    const tender = await this.loadTender(tenderId);

    if (tender.status !== TenderStatus.open) {
      throw new BadRequestException(
        tender.status === TenderStatus.closed
          ? 'Tender is closed for new bids'
          : 'Tender is not open for bids',
      );
    }

    const terms = this.buildBidTerms(dto);

    const bid = await this.prisma.$transaction(async (tx) => {
      const nextBid = await tx.bid.upsert({
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

      if (!tender.closesAt) {
        const submittedCount = await tx.bid.count({
          where: { tenderId, status: BidStatus.submitted },
        });
        if (submittedCount > 0) {
          await tx.tender.updateMany({
            where: { id: tenderId, closesAt: null },
            data: {
              closesAt: this.biddingDeadlineFrom(new Date()),
            },
          });
        }
      }

      return nextBid;
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextBid = await tx.bid.update({
        where: { id: bid.id },
        data: { status: BidStatus.withdrawn },
        include: { contractor: true },
      });

      const submittedCount = await tx.bid.count({
        where: { tenderId, status: BidStatus.submitted },
      });
      if (submittedCount === 0) {
        await tx.tender.update({
          where: { id: tenderId },
          data: {
            closesAt: null,
            status: TenderStatus.open,
          },
        });
      }

      return nextBid;
    });

    return this.mapBid(updated);
  }

  async getTenderForContractor(userId: string, tenderId: string) {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);

    const myBid =
      tender.bids.find(
        (b) =>
          b.contractorId === profile.id && b.status !== BidStatus.withdrawn,
      ) ?? null;

    return { tender: this.mapTender(tender), myBid: myBid ? this.mapBid(myBid) : null };
  }
}
