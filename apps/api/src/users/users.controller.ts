import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from './users.service';

@Controller('v1')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return {
      id: user.id,
      keycloakSub: user.keycloakSub,
      email: user.email,
      displayName: user.displayName,
      roles: req.user.realm_access?.roles ?? [],
    };
  }
}
