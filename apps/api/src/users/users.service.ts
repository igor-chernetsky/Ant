import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { extractKeycloakSub, JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import { SupplyDirectoryService } from '../supply-directory/supply-directory.service';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from './locale.types';

const PLATFORM_KEYCLOAK_ROLES = new Set([
  'client',
  'contractor',
  'designer',
  'admin',
]);

function extractPlatformKeycloakRoles(payload: JwtPayload): string[] {
  const roles = payload.realm_access?.roles ?? [];
  return [...new Set(roles.filter((role) => PLATFORM_KEYCLOAK_ROLES.has(role)))].sort();
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supplyDirectory: SupplyDirectoryService,
  ) {}

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
    const keycloakRoles = extractPlatformKeycloakRoles(payload);

    try {
      const existing = await this.prisma.user.findUnique({
        where: { keycloakSub },
      });

      if (existing) {
        if (existing.deletedAt) {
          // The Keycloak identity was removed by an admin; a still-valid access
          // token must not keep the account usable.
          throw new UnauthorizedException('Account has been deleted');
        }
        return this.prisma.user.update({
          where: { keycloakSub },
          data: {
            email: email ?? undefined,
            displayName: displayName ?? undefined,
            keycloakRoles,
          },
        });
      }

      const created = await this.prisma.user.create({
        data: { keycloakSub, email, displayName, keycloakRoles },
      });

      try {
        const removed = await this.supplyDirectory.removeByEmail(email);
        if (removed > 0) {
          this.logger.log(
            `Removed ${removed} supply registry entr${removed === 1 ? 'y' : 'ies'} for newly registered ${email}`,
          );
        }
      } catch (cleanupError) {
        this.logger.warn(
          `Failed to remove supply registry entries for ${email}`,
          cleanupError,
        );
      }

      return created;
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

      // Race: another request created the user between find and create.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.user.findUnique({
          where: { keycloakSub },
        });
        if (raced) {
          return this.prisma.user.update({
            where: { keycloakSub },
            data: {
              email: email ?? undefined,
              displayName: displayName ?? undefined,
              keycloakRoles,
            },
          });
        }
      }

      throw error;
    }
  }

  async isContractor(userId: string): Promise<boolean> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      select: { id: true, kind: true },
    });
    return Boolean(profile && profile.kind === 'contractor');
  }

  /**
   * Mark a user deleted: hidden from admin lists and unable to authenticate.
   *
   * The row is kept on purpose — projects, contracts, addenda, progress claims,
   * defects and reviews cascade from `users`, so a physical delete would destroy
   * the other party's legal history. Returns the Keycloak subject so the caller
   * can remove the identity there.
   */
  async softDeleteUser(
    adminUserId: string,
    userId: string,
  ): Promise<{
    id: string;
    email: string | null;
    keycloakSub: string;
    deletedAt: string;
    alreadyDeleted: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, keycloakSub: true, deletedAt: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.deletedAt) {
      return {
        id: user.id,
        email: user.email,
        keycloakSub: user.keycloakSub,
        deletedAt: user.deletedAt.toISOString(),
        alreadyDeleted: true,
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), deletedByUserId: adminUserId },
      select: { deletedAt: true },
    });

    return {
      id: user.id,
      email: user.email,
      keycloakSub: user.keycloakSub,
      deletedAt: (updated.deletedAt ?? new Date()).toISOString(),
      alreadyDeleted: false,
    };
  }

  async isDesigner(userId: string): Promise<boolean> {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      select: { id: true, kind: true },
    });
    return Boolean(profile && profile.kind === 'designer');
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
    isDesigner: boolean;
    preferredLocale: SupportedLocale;
  }> {
    const roles = payload.realm_access?.roles ?? [];
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId: user.id },
      select: { companyName: true, kind: true },
    });
    const isContractor =
      roles.includes('contractor') || profile?.kind === 'contractor';
    const isDesigner =
      roles.includes('designer') || profile?.kind === 'designer';

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
      isDesigner,
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
