import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { TendersService } from './tenders.service';

@Controller('v1/projects/:projectId/tender')
@UseGuards(JwtAuthGuard)
export class ProjectTenderController {
  constructor(
    private readonly tendersService: TendersService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUser(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get()
  async getTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    const tender = await this.tendersService.getForProject(user.id, projectId);
    return tender ?? { tender: null };
  }

  @Post()
  async createTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.createTender(user.id, projectId);
  }

  @Post('start')
  async startTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.startTender(user.id, projectId);
  }

  @Post('bids/:bidId/select')
  async selectBid(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.selectBid(user.id, projectId, bidId);
  }
}
