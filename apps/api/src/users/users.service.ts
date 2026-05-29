import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateFromJwt(payload: JwtPayload): Promise<User> {
    const keycloakSub = payload.sub;
    if (!keycloakSub) {
      throw new BadRequestException('JWT is missing the sub claim');
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
}
