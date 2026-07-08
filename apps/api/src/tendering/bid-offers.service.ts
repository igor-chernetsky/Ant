import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BidStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BidOfferResponse,
  BidTermsV1,
  CounterOfferTargetsResponse,
  CreateCounterOfferResponse,
  MAX_BID_APPROACH_LENGTH,
  MAX_BID_LINE_ITEMS,
  MAX_BID_NOTES_LENGTH,
  MAX_BID_SCOPE_LENGTH,
  SubmitCounterOfferDto,
} from './tendering.types';
import { assertBreakdownMatchesTotal } from './bid-breakdown.util';

const MAX_BULK_COUNTER_OFFERS = 30;

@Injectable()
export class BidOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private mapOffer(offer: {
    id: string;
    bidId: string;
    authorRole: 'client' | 'contractor';
    authorId: string;
    amount: { toString(): string };
    durationDays: number | null;
    termsJson: unknown;
    note: string | null;
    createdAt: Date;
  }): BidOfferResponse {
    return {
      id: offer.id,
      bidId: offer.bidId,
      authorRole: offer.authorRole,
      authorId: offer.authorId,
      amount: offer.amount.toString(),
      durationDays: offer.durationDays,
      terms: (offer.termsJson as BidTermsV1 | null) ?? null,
      note: offer.note,
      createdAt: offer.createdAt.toISOString(),
    };
  }

  private buildTerms(dto: SubmitCounterOfferDto): BidTermsV1 {
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
    };
  }

  async listForBid(
    userId: string,
    bidId: string,
    projectId?: string,
  ): Promise<BidOfferResponse[]> {
    await this.assertBidAccess(userId, bidId, projectId);

    const offers = await this.prisma.bidOffer.findMany({
      where: { bidId },
      orderBy: { createdAt: 'asc' },
    });

    return offers.map((offer) => this.mapOffer(offer));
  }

  async listPendingCounterOfferTargets(
    clientId: string,
    projectId: string,
  ): Promise<CounterOfferTargetsResponse> {
    const bidIds = await this.findPendingCounterOfferBidIds(clientId, projectId);
    return {
      count: bidIds.length,
      bidIds,
    };
  }

  async createClientCounterOffer(
    clientId: string,
    projectId: string,
    bidId: string,
    dto: SubmitCounterOfferDto,
  ): Promise<CreateCounterOfferResponse> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const bid = await this.assertClientBid(clientId, projectId, bidId);
    if (bid.status !== BidStatus.submitted) {
      throw new BadRequestException(
        'Counter-offers are only allowed after a contractor proposal is submitted',
      );
    }

    const terms = this.buildTerms(dto);
    assertBreakdownMatchesTotal(dto.amount, terms.lineItems);

    const targetBidIds = dto.applyToAllPending
      ? await this.findPendingCounterOfferBidIds(clientId, projectId)
      : [bidId];

    if (!targetBidIds.includes(bidId)) {
      throw new BadRequestException(
        'This bid already has a client counter-offer. Send a new one only to other contractors.',
      );
    }

    if (targetBidIds.length > MAX_BULK_COUNTER_OFFERS) {
      throw new BadRequestException(
        `At most ${MAX_BULK_COUNTER_OFFERS} counter-offers can be sent at once`,
      );
    }

    const bids = await this.prisma.bid.findMany({
      where: {
        id: { in: targetBidIds },
        tender: { projectId },
        status: BidStatus.submitted,
      },
      include: {
        contractor: true,
        tender: { include: { project: true } },
      },
    });

    if (bids.length === 0) {
      throw new BadRequestException('No eligible bids found for counter-offer');
    }

    const existingOffers = await this.prisma.bidOffer.findMany({
      where: {
        bidId: { in: targetBidIds },
        authorRole: 'client',
      },
      select: { bidId: true },
    });
    const alreadyOffered = new Set(existingOffers.map((row) => row.bidId));
    const eligibleBids = bids.filter((row) => !alreadyOffered.has(row.id));

    if (eligibleBids.length === 0) {
      throw new BadRequestException(
        'All selected contractors already have a client counter-offer',
      );
    }

    const note = dto.notes?.trim() || null;
    const termsJson = terms as unknown as Prisma.InputJsonValue;
    const createdOffers = await this.prisma.$transaction(async (tx) => {
      const offers = [];
      for (const targetBid of eligibleBids) {
        const offer = await tx.bidOffer.create({
          data: {
            bidId: targetBid.id,
            authorRole: 'client',
            authorId: clientId,
            amount: dto.amount,
            durationDays: dto.durationDays ?? null,
            termsJson,
            note,
          },
        });
        offers.push({ offer, bid: targetBid });
      }
      return offers;
    });

    for (const { bid: targetBid } of createdOffers) {
      this.notifications.dispatch(
        this.notifications.notifyContractorCounterOffer({
          contractorUserId: targetBid.contractor.userId,
          projectId: targetBid.tender.projectId,
          projectTitle: targetBid.tender.project.title,
          amount: String(dto.amount),
        }),
      );
    }

    const primary =
      createdOffers.find((row) => row.offer.bidId === bidId) ?? createdOffers[0];

    return {
      offer: this.mapOffer(primary.offer),
      sentToBidCount: createdOffers.length,
    };
  }

  private async findPendingCounterOfferBidIds(
    clientId: string,
    projectId: string,
  ): Promise<string[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }

    const tender = await this.prisma.tender.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!tender) {
      return [];
    }

    const submittedBids = await this.prisma.bid.findMany({
      where: {
        tenderId: tender.id,
        status: BidStatus.submitted,
      },
      select: { id: true },
    });
    if (submittedBids.length === 0) {
      return [];
    }

    const bidIds = submittedBids.map((row) => row.id);
    const clientOffers = await this.prisma.bidOffer.findMany({
      where: {
        bidId: { in: bidIds },
        authorRole: 'client',
      },
      select: { bidId: true },
    });
    const offeredBidIds = new Set(clientOffers.map((row) => row.bidId));

    return bidIds.filter((id) => !offeredBidIds.has(id));
  }

  private async assertClientBid(
    clientId: string,
    projectId: string,
    bidId: string,
  ) {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        contractor: true,
        tender: { include: { project: true } },
      },
    });
    if (!bid || bid.tender.projectId !== projectId) {
      throw new NotFoundException('Bid not found');
    }
    if (bid.tender.project.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    return bid;
  }

  private async assertBidAccess(
    userId: string,
    bidId: string,
    projectId?: string,
  ) {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        contractor: true,
        tender: { include: { project: true } },
      },
    });
    if (!bid) {
      throw new NotFoundException('Bid not found');
    }
    if (projectId && bid.tender.projectId !== projectId) {
      throw new NotFoundException('Bid not found for this project');
    }

    const isClient = bid.tender.project.clientId === userId;
    const isContractor = bid.contractor.userId === userId;
    if (!isClient && !isContractor) {
      throw new ForbiddenException('Access denied');
    }
  }
}
