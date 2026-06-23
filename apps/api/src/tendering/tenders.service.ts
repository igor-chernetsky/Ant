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
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeContractTerms } from './commercial-proposal.template';
import {
  BidResponse,
  BidTermsV1,
  DEFAULT_TENDER_DURATION_DAYS,
  MAX_BID_APPROACH_LENGTH,
  MAX_BID_LINE_ITEMS,
  MAX_BID_NOTES_LENGTH,
  MAX_BID_SCOPE_LENGTH,
  MAX_BID_SPECIAL_CONDITIONS_LENGTH,
  SubmitBidDto,
  UpdateBidContractTermsDto,
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
    private readonly notifications: NotificationsService,
  ) {}

  private mapBid(bid: Bid & { contractor: ContractorProfile }): BidResponse {
    return {
      id: bid.id,
      tenderId: bid.tenderId,
      contractorId: bid.contractorId,
      companyName: bid.contractor.companyName,
      status: bid.status,
      contenderNumber: bid.contenderNumber,
      enrolledAt: bid.enrolledAt?.toISOString() ?? null,
      amount: bid.amount?.toString() ?? null,
      durationDays: bid.durationDays,
      terms: (bid.termsJson as BidTermsV1 | null) ?? null,
      submittedAt: bid.submittedAt?.toISOString() ?? null,
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
      applicationCount: bids.length,
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

    this.notifications.dispatch(
      this.notifications.notifyMatchingContractorsForProject(projectId),
    );

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

  async revertTenderToEstimated(
    clientId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.assertProjectOwner(projectId, clientId);

    if (project.status !== ProjectStatus.in_tender) {
      throw new BadRequestException('Project is not published for bids');
    }

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      include: {
        bids: {
          where: { status: { not: BidStatus.withdrawn } },
          select: { id: true },
        },
      },
    });

    if (!tender) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.estimated },
      });
      return;
    }

    if (tender.status !== TenderStatus.open) {
      throw new BadRequestException(
        'Tender can only be reverted while it is open',
      );
    }

    if (tender.bids.length > 0) {
      throw new BadRequestException(
        'Cannot revert tender after contractors have applied',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tender.delete({ where: { id: tender.id } });
      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.estimated },
      });
    });
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

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true },
    });
    const selectedBid = updated.bids.find((b) => b.id === bidId);
    const rejectedBids = updated.bids.filter(
      (b) => b.id !== bidId && b.status === BidStatus.rejected,
    );

    if (project && selectedBid) {
      this.notifications.dispatch(
        this.notifications.notifyContractorBidSelected({
          contractorUserId: selectedBid.contractor.userId,
          projectId,
          projectTitle: project.title,
        }),
      );
      for (const rejected of rejectedBids) {
        this.notifications.dispatch(
          this.notifications.notifyContractorBidRejected({
            contractorUserId: rejected.contractor.userId,
            projectId,
            projectTitle: project.title,
          }),
        );
      }
    }

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
        status: {
          in: [
            BidStatus.clarifying,
            BidStatus.enrolled,
            BidStatus.submitted,
            BidStatus.selected,
          ],
        },
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
      contenderNumber: bid.contenderNumber,
      bidAmount:
        bid.amount != null && bid.status === BidStatus.submitted
          ? bid.amount.toString()
          : null,
      submittedAt: bid.submittedAt?.toISOString() ?? null,
      isActiveProject: bid.status === BidStatus.selected,
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

    const tenderAwarded =
      tender?.status === TenderStatus.awarded ||
      project.status === ProjectStatus.contractor_selected;

    const accessDenied = Boolean(
      myBid && tenderAwarded && myBid.status !== BidStatus.selected,
    );

    const tenderOpen = tender?.status === TenderStatus.open;

    return {
      tenderId: tender?.id ?? null,
      tenderStatus: tender?.status ?? null,
      closesAt: tender?.closesAt?.toISOString() ?? null,
      myBid: myBid ? this.mapBid(myBid) : null,
      verificationStatus: profile.verificationStatus,
      canStartClarification: Boolean(tenderOpen && !myBid),
      canEnroll: Boolean(tenderOpen && myBid?.status === BidStatus.clarifying),
      canSubmitProposal: Boolean(
        tenderOpen &&
          myBid &&
          (myBid.status === BidStatus.enrolled ||
            myBid.status === BidStatus.submitted),
      ),
      canWithdraw: Boolean(
        tenderOpen &&
          myBid &&
          (myBid.status === BidStatus.clarifying ||
            myBid.status === BidStatus.enrolled ||
            myBid.status === BidStatus.submitted),
      ),
      accessDenied,
      projectStatus: project.status,
    };
  }

  async startClarification(
    userId: string,
    tenderId: string,
  ): Promise<BidResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);

    if (tender.status !== TenderStatus.open) {
      throw new BadRequestException('Tender is not open');
    }

    const existing = tender.bids.find(
      (b) =>
        b.contractorId === profile.id && b.status !== BidStatus.withdrawn,
    );
    if (existing) {
      return this.mapBid(existing);
    }

    const bid = await this.prisma.bid.create({
      data: {
        tenderId,
        contractorId: profile.id,
        status: BidStatus.clarifying,
      },
      include: { contractor: true },
    });

    return this.mapBid(bid);
  }

  async enrollInTender(userId: string, tenderId: string): Promise<BidResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);

    if (tender.status !== TenderStatus.open) {
      throw new BadRequestException('Tender is not open');
    }

    const bid = tender.bids.find(
      (b) =>
        b.contractorId === profile.id && b.status === BidStatus.clarifying,
    );
    if (!bid) {
      throw new BadRequestException(
        'Start clarification and discuss scope before enrolling',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const currentTender = await tx.tender.findUnique({
        where: { id: tenderId },
      });
      if (!currentTender) {
        throw new NotFoundException('Tender not found');
      }

      const contenderNumber = currentTender.nextContenderNumber;
      await tx.tender.update({
        where: { id: tenderId },
        data: { nextContenderNumber: contenderNumber + 1 },
      });

      return tx.bid.update({
        where: { id: bid.id },
        data: {
          status: BidStatus.enrolled,
          contenderNumber,
          enrolledAt: new Date(),
        },
        include: { contractor: true },
      });
    });

    const tenderRow = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: { project: { select: { id: true, title: true, clientId: true } } },
    });
    if (tenderRow && updated.contenderNumber != null) {
      this.notifications.dispatch(
        this.notifications.notifyClientBidEnrolled({
          clientId: tenderRow.project.clientId,
          projectId: tenderRow.project.id,
          projectTitle: tenderRow.project.title,
          companyName: updated.contractor.companyName ?? 'Contractor',
          contenderNumber: updated.contenderNumber,
        }),
      );
    }

    return this.mapBid(updated);
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
        if (!trade) {
          throw new BadRequestException('Each line item needs a trade');
        }
        if (!Number.isFinite(amount) || amount < 0) {
          throw new BadRequestException(
            'Line item amounts must be zero or positive',
          );
        }
        return {
          trade,
          ...(description ? { description } : {}),
          amount,
        };
      });
    }

    return {
      notes: notes || undefined,
      approach: approach || undefined,
      scopeSummary: scopeSummary || undefined,
      lineItems: lineItems?.length ? lineItems : undefined,
      contractTerms: this.normalizeAndValidateContractTerms(dto.contractTerms),
    };
  }

  private normalizeAndValidateContractTerms(
    raw?: SubmitBidDto['contractTerms'],
  ) {
    const contractTerms = normalizeContractTerms(raw);
    if (
      contractTerms?.specialConditions &&
      contractTerms.specialConditions.length > MAX_BID_SPECIAL_CONDITIONS_LENGTH
    ) {
      throw new BadRequestException(
        `Special conditions must be at most ${MAX_BID_SPECIAL_CONDITIONS_LENGTH} characters`,
      );
    }
    return contractTerms;
  }

  private mergeContractTerms(
    existingTerms: BidTermsV1 | null,
    incoming?: SubmitBidDto['contractTerms'],
  ): SubmitBidDto['contractTerms'] {
    if (!incoming && !existingTerms?.contractTerms) {
      return undefined;
    }
    return {
      ...existingTerms?.contractTerms,
      ...incoming,
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

    const existing = tender.bids.find(
      (b) =>
        b.contractorId === profile.id &&
        (b.status === BidStatus.enrolled ||
          b.status === BidStatus.submitted),
    );
    if (!existing) {
      throw new BadRequestException(
        'Enroll as a contender before submitting a commercial proposal',
      );
    }

    const terms = this.buildBidTerms({
      ...dto,
      contractTerms: this.mergeContractTerms(
        (existing.termsJson as BidTermsV1 | null) ?? null,
        dto.contractTerms,
      ),
    });

    const bid = await this.prisma.$transaction(async (tx) => {
      const nextBid = await tx.bid.update({
        where: { id: existing.id },
        data: {
          amount: dto.amount,
          durationDays: dto.durationDays ?? null,
          termsJson: terms as unknown as Prisma.InputJsonValue,
          status: BidStatus.submitted,
          submittedAt: new Date(),
        },
        include: { contractor: true },
      });

      await tx.bidOffer.create({
        data: {
          bidId: existing.id,
          authorRole: 'contractor',
          authorId: userId,
          amount: dto.amount,
          durationDays: dto.durationDays ?? null,
          termsJson: terms as unknown as Prisma.InputJsonValue,
          note: dto.notes?.trim() || null,
        },
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

    const tenderRow = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      include: { project: { select: { id: true, title: true, clientId: true } } },
    });
    if (tenderRow) {
      this.notifications.dispatch(
        this.notifications.notifyClientBidSubmitted({
          clientId: tenderRow.project.clientId,
          projectId: tenderRow.project.id,
          projectTitle: tenderRow.project.title,
          companyName: bid.contractor.companyName ?? 'Contractor',
          amount: String(dto.amount),
        }),
      );
    }

    return this.mapBid(bid);
  }

  async updateBidContractTermsForClient(
    clientId: string,
    projectId: string,
    bidId: string,
    dto: UpdateBidContractTermsDto,
  ): Promise<BidResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    const bid = await this.prisma.bid.findFirst({
      where: { id: bidId, tender: { projectId } },
      include: { contractor: true },
    });
    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    const editableStatuses: BidStatus[] = [
      BidStatus.submitted,
      BidStatus.selected,
      BidStatus.rejected,
    ];
    if (!editableStatuses.includes(bid.status)) {
      throw new BadRequestException(
        'Contract terms can be updated after a proposal is submitted',
      );
    }

    const existingTerms = (bid.termsJson as BidTermsV1 | null) ?? {};
    const contractTerms = this.normalizeAndValidateContractTerms(
      this.mergeContractTerms(existingTerms, dto.contractTerms),
    );

    const updatedTerms: BidTermsV1 = {
      ...existingTerms,
      contractTerms,
    };

    const updated = await this.prisma.bid.update({
      where: { id: bidId },
      data: {
        termsJson: updatedTerms as unknown as Prisma.InputJsonValue,
      },
      include: { contractor: true },
    });

    return this.mapBid(updated);
  }

  async withdrawBid(userId: string, tenderId: string): Promise<BidResponse> {
    const profile = await this.contractorProfiles.requireByUserId(userId);
    const tender = await this.loadTender(tenderId);

    if (tender.status !== TenderStatus.open) {
      throw new BadRequestException('Tender is not open');
    }

    const bid = tender.bids.find(
      (b) =>
        b.contractorId === profile.id &&
        (b.status === BidStatus.clarifying ||
          b.status === BidStatus.enrolled ||
          b.status === BidStatus.submitted),
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
