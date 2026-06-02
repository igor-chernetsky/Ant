import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { extractKeycloakSub, JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateFromJwt(payload: JwtPayload): Promise<User> {
    const keycloakSub = extractKeycloakSub(payload);
    if (!keycloakSub) {
      throw new BadRequestException(
        'JWT is missing sub. Request token with scope=openid profile email',
      );
    }

    const email = payload.email ?? null;
    const displayName =
      payload.name ?? payload.preferred_username ?? email ?? null;

    try {
      return await this.prisma.user.upsert({
        where: { keycloakSub },
        create: { keycloakSub, email, displayName },
        update: {
          email: email ?? undefined,
          displayName: displayName ?? undefined,
        },
      });
    } catch (error) {
      this.logger.error('findOrCreateFromJwt failed', error);

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        throw new InternalServerErrorException(
          'Database schema is missing. Run: npx prisma migrate deploy',
        );
      }

      throw error;
    }
  }

  async isContractor(userId: string): Promise<boolean> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return Boolean(profile);
  }
}
