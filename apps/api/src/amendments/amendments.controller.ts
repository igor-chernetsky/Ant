import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { AmendmentsService } from './amendments.service';
import { CreateAmendmentDto } from './amendments.types';

@Controller('v1/projects/:projectId/amendments')
@UseGuards(JwtAuthGuard)
export class AmendmentsController {
  constructor(
    private readonly amendmentsService: AmendmentsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async list(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.amendmentsService.listForProject(user.id, projectId);
  }

  @Post()
  async create(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: CreateAmendmentDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.amendmentsService.create(user.id, projectId, body);
  }

  @Post('process')
  async processPending(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.amendmentsService.processPending(user.id, projectId);
  }

  @Post(':amendmentId/process')
  async processOne(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('amendmentId') amendmentId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.amendmentsService.processOne(user.id, projectId, amendmentId);
  }
}
