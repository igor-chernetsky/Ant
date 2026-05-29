import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    info: Error | undefined,
  ): TUser {
    if (err) {
      throw err;
    }
    if (!user) {
      const message =
        info?.message ??
        'Invalid or missing bearer token. Check issuer, expiry, and scope=openid.';
      throw new UnauthorizedException(message);
    }
    return user;
  }
}
