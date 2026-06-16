import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BidStatus, TenderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenderAutoCloseService {
  private readonly logger = new Logger(TenderAutoCloseService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs inside the API process (no separate worker required on EC2).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async closeExpiredOnSchedule(): Promise<void> {
    const reopened = await this.reopenTendersClosedWithoutBids();
    if (reopened > 0) {
      this.logger.log(`Re-opened ${reopened} tender(s) closed without bids`);
    }

    const cleared = await this.clearDeadlinesWithoutBids();
    if (cleared > 0) {
      this.logger.log(`Cleared deadline on ${cleared} tender(s) without bids`);
    }

    const closed = await this.closeExpiredTenders();
    if (closed > 0) {
      this.logger.log(`Auto-closed ${closed} expired tender(s)`);
    }
  }

  async reopenTendersClosedWithoutBids(): Promise<number> {
    const result = await this.prisma.tender.updateMany({
      where: {
        status: TenderStatus.closed,
        bids: { none: { status: BidStatus.submitted } },
      },
      data: {
        status: TenderStatus.open,
        closesAt: null,
      },
    });
    return result.count;
  }

  async clearDeadlinesWithoutBids(): Promise<number> {
    const result = await this.prisma.tender.updateMany({
      where: {
        status: TenderStatus.open,
        closesAt: { not: null },
        bids: { none: { status: BidStatus.submitted } },
      },
      data: { closesAt: null },
    });
    return result.count;
  }

  async closeExpiredTenders(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.tender.updateMany({
      where: {
        status: TenderStatus.open,
        closesAt: { not: null, lte: now },
        bids: { some: { status: BidStatus.submitted } },
      },
      data: { status: TenderStatus.closed },
    });
    return result.count;
  }

  async closeTenderIfExpired(tenderId: string): Promise<boolean> {
    const now = new Date();
    const result = await this.prisma.tender.updateMany({
      where: {
        id: tenderId,
        status: TenderStatus.open,
        closesAt: { not: null, lte: now },
        bids: { some: { status: BidStatus.submitted } },
      },
      data: { status: TenderStatus.closed },
    });
    return result.count > 0;
  }
}
