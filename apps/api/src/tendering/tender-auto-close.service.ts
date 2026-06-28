import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BidStatus, TenderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isApplicationsDeadlinePassed } from './tender-deadline';

@Injectable()
export class TenderAutoCloseService {
  private readonly logger = new Logger(TenderAutoCloseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async closeExpiredOnSchedule(): Promise<void> {
    const notified = await this.notifyExpiredApplicationDeadlines();
    if (notified > 0) {
      this.logger.log(`Notified ${notified} client(s) about application deadlines`);
    }

    const closed = await this.closeExpiredTenders();
    if (closed > 0) {
      this.logger.log(`Closed ${closed} tender(s) after application deadline`);
    }
  }

  async notifyExpiredApplicationDeadlines(): Promise<number> {
    const now = new Date();
    const tenders = await this.prisma.tender.findMany({
      where: {
        status: { in: [TenderStatus.open, TenderStatus.closed] },
        closesAt: { not: null, lte: now },
        deadlineNotifiedAt: null,
      },
      include: {
        project: { select: { id: true, title: true, clientId: true } },
        bids: {
          where: { status: { not: BidStatus.withdrawn } },
          select: { id: true },
        },
      },
    });

    let count = 0;
    for (const tender of tenders) {
      if (!isApplicationsDeadlinePassed(tender.closesAt, now)) {
        continue;
      }

      await this.prisma.tender.update({
        where: { id: tender.id },
        data: { deadlineNotifiedAt: now },
      });

      this.notifications.dispatch(
        this.notifications.notifyClientTenderDeadlineReached({
          clientId: tender.project.clientId,
          projectId: tender.project.id,
          projectTitle: tender.project.title,
          applicationCount: tender.bids.length,
          submittedBidCount: await this.prisma.bid.count({
            where: {
              tenderId: tender.id,
              status: BidStatus.submitted,
            },
          }),
        }),
      );
      count += 1;
    }

    return count;
  }

  async closeExpiredTenders(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.tender.updateMany({
      where: {
        status: TenderStatus.open,
        closesAt: { not: null, lte: now },
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
      },
      data: { status: TenderStatus.closed },
    });
    return result.count > 0;
  }
}
