import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenderStatus } from '@prisma/client';
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
    const closed = await this.closeExpiredTenders();
    if (closed > 0) {
      this.logger.log(`Auto-closed ${closed} expired tender(s)`);
    }
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
