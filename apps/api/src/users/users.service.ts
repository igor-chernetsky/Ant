import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { extractKeycloakSub, JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from './locale.types';

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

  async buildMeResponse(
    user: User,
    payload: JwtPayload,
  ): Promise<{
    id: string;
    keycloakSub: string;
    email: string | null;
    displayName: string | null;
    companyName: string | null;
    roles: string[];
    isContractor: boolean;
    preferredLocale: SupportedLocale;
  }> {
    const roles = payload.realm_access?.roles ?? [];
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId: user.id },
      select: { companyName: true },
    });
    const hasContractorProfile = Boolean(profile);
    const isContractor =
      roles.includes('contractor') || hasContractorProfile;

    const preferredLocale = isSupportedLocale(user.preferredLocale)
      ? user.preferredLocale
      : DEFAULT_LOCALE;

    return {
      id: user.id,
      keycloakSub: user.keycloakSub,
      email: user.email,
      displayName: user.displayName,
      companyName: profile?.companyName ?? null,
      roles,
      isContractor,
      preferredLocale,
    };
  }

  async updatePreferredLocale(
    userId: string,
    locale: string,
  ): Promise<{ preferredLocale: SupportedLocale }> {
    if (!isSupportedLocale(locale)) {
      throw new BadRequestException('Unsupported locale');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { preferredLocale: locale },
      select: { preferredLocale: true },
    });

    return {
      preferredLocale: isSupportedLocale(user.preferredLocale)
        ? user.preferredLocale
        : DEFAULT_LOCALE,
    };
  }
}
