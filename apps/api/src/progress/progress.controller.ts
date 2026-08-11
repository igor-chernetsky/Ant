import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { ProgressService } from './progress.service';
import type {
  RejectProgressClaimDto,
  UpdateProgressClaimDto,
} from './progress.types';

@Controller('v1/projects/:projectId/progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(
    private readonly progressService: ProgressService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async getOverview(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.progressService.getOverview(user.id, projectId);
  }

  @Post('claims')
  async createDraft(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.progressService.createOrGetDraft(user.id, projectId);
  }

  @Patch('claims/:claimId')
  async updateDraft(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('claimId') claimId: string,
    @Body() body: UpdateProgressClaimDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.progressService.updateDraft(user.id, projectId, claimId, {
      note: body?.note,
      lines: Array.isArray(body?.lines) ? body.lines : [],
    });
  }

  @Post('claims/:claimId/submit')
  async submit(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('claimId') claimId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.progressService.submit(user.id, projectId, claimId);
  }

  @Post('claims/:claimId/approve')
  async approve(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('claimId') claimId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.progressService.approve(user.id, projectId, claimId);
  }

  @Post('claims/:claimId/reject')
  async reject(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('claimId') claimId: string,
    @Body() body: RejectProgressClaimDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.progressService.reject(user.id, projectId, claimId, {
      reason: body?.reason,
    });
  }
}
