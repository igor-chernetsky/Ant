import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BidOfferResponse,
  BidTermsV1,
  MAX_BID_APPROACH_LENGTH,
  MAX_BID_LINE_ITEMS,
  MAX_BID_NOTES_LENGTH,
  MAX_BID_SCOPE_LENGTH,
  SubmitCounterOfferDto,
} from './tendering.types';

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
      lineItems = lineItems.map((item) => ({
        trade: item.trade.trim(),
        description: item.description.trim(),
        amount: Number(item.amount),
      }));
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

  async createClientCounterOffer(
    clientId: string,
    projectId: string,
    bidId: string,
    dto: SubmitCounterOfferDto,
  ): Promise<BidOfferResponse> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const bid = await this.assertClientBid(clientId, projectId, bidId);
    if (bid.status !== 'submitted') {
      throw new BadRequestException(
        'Counter-offers are only allowed after a contractor proposal is submitted',
      );
    }

    const terms = this.buildTerms(dto);
    const offer = await this.prisma.bidOffer.create({
      data: {
        bidId,
        authorRole: 'client',
        authorId: clientId,
        amount: dto.amount,
        durationDays: dto.durationDays ?? null,
        termsJson: terms as unknown as Prisma.InputJsonValue,
        note: dto.notes?.trim() || null,
      },
    });

    this.notifications.dispatch(
      this.notifications.notifyContractorCounterOffer({
        contractorUserId: bid.contractor.userId,
        projectId: bid.tender.projectId,
        projectTitle: bid.tender.project.title,
        amount: String(dto.amount),
      }),
    );

    return this.mapOffer(offer);
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
