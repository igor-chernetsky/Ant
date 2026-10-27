import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Readiness: the database answers too. */
  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }

  /**
   * Liveness: the process is alive and its event loop still answers.
   *
   * Deliberately touches nothing — a slow or restarting database must not make the
   * container look dead. The container healthcheck hits this endpoint, so a process
   * wedged in a synchronous loop (the estimate-recalculation freeze) reports
   * `unhealthy` instead of silently accepting connections forever.
   */
  @Get('health/live')
  live() {
    return { status: 'ok' };
  }
}
