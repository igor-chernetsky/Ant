import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateFromJwt(payload: JwtPayload): Promise<User> {
    const keycloakSub = payload.sub;
    const email = payload.email ?? null;
    const displayName =
      payload.name ?? payload.preferred_username ?? email ?? null;

    return this.prisma.user.upsert({
      where: { keycloakSub },
      create: { keycloakSub, email, displayName },
      update: {
        email: email ?? undefined,
        displayName: displayName ?? undefined,
      },
    });
  }
}
