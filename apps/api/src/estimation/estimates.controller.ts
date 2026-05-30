import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { EstimatesService } from './estimates.service';

@Controller('v1/projects/:projectId/estimate')
@UseGuards(JwtAuthGuard)
export class EstimatesController {
  constructor(
    private readonly estimatesService: EstimatesService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async getLatest(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    const estimate = await this.estimatesService.getLatestForProject(
      user.id,
      projectId,
    );
    return estimate ?? { estimate: null };
  }
}
