import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  guestTokenHashesMatch,
  hashGuestProjectToken,
  isGuestProjectExpired,
} from './guest-project.util';

export interface GuestProjectRequest extends Request {
  params: Record<string, string>;
  guestProjectId?: string;
}

/**
 * Authorizes the anonymous owner of a guest project.
 *
 * The guest holds an opaque token (kept in an httpOnly cookie by the BFF and
 * forwarded as `x-ant-guest-token`); only its SHA-256 is stored. The guard also
 * rejects claimed projects, so the guest path closes for good once the owner
 * registers, and rejects projects past their 24-hour lifetime.
 */
@Injectable()
export class GuestProjectGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<GuestProjectRequest>();

    const projectId =
      request.params?.projectId ?? request.params?.id ?? '';
    const token = request.header('x-ant-guest-token')?.trim();
    if (!projectId) {
      throw new UnauthorizedException('Missing guest project token');
    }
    if (!token) {
      throw new UnauthorizedException('Missing guest project token');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        guestTokenHash: true,
        guestExpiresAt: true,
      },
    });

    if (!project || project.clientId !== null || !project.guestTokenHash) {
      throw new ForbiddenException('Access denied');
    }
    if (isGuestProjectExpired(project.guestExpiresAt)) {
      throw new ForbiddenException(
        'This project draft has expired. Please start a new one.',
      );
    }
    if (
      !guestTokenHashesMatch(
        project.guestTokenHash,
        hashGuestProjectToken(token),
      )
    ) {
      throw new ForbiddenException('Access denied');
    }

    request.guestProjectId = project.id;
    return true;
  }
}
