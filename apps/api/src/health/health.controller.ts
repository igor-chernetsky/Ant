import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    // Ensures Prisma migrations created app tables (not only DB connectivity).
    await this.prisma.user.count();
    return { status: 'ok' };
  }
}
