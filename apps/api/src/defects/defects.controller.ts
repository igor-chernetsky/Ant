import {
  Body,
  Controller,
  Delete,
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
import { DefectsService } from './defects.service';
import type { CreateDefectDto, DefectCommentDto } from './defects.types';

@Controller('v1/projects/:projectId/defects')
@UseGuards(JwtAuthGuard)
export class DefectsController {
  constructor(
    private readonly defectsService: DefectsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async list(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.defectsService.list(user.id, projectId);
  }

  @Post()
  async create(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: CreateDefectDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.defectsService.create(user.id, projectId, {
      description: body?.description,
    });
  }

  @Delete(':defectId')
  async delete(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.defectsService.delete(user.id, projectId, defectId);
  }

  @Post(':defectId/accept')
  async accept(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.defectsService.accept(user.id, projectId, defectId);
  }

  @Post(':defectId/decline')
  async decline(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
    @Body() body: DefectCommentDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.defectsService.decline(user.id, projectId, defectId, {
      reason: body?.reason,
    });
  }

  @Post(':defectId/resubmit')
  async resubmit(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
    @Body() body: DefectCommentDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.defectsService.resubmit(user.id, projectId, defectId, {
      comment: body?.comment,
    });
  }

  @Post(':defectId/complete')
  async complete(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
    @Body() body: DefectCommentDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.defectsService.complete(user.id, projectId, defectId, {
      comment: body?.comment,
    });
  }

  @Post(':defectId/accept-completion')
  async acceptCompletion(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.defectsService.acceptCompletion(user.id, projectId, defectId);
  }

  @Post(':defectId/reject-completion')
  async rejectCompletion(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('defectId') defectId: string,
    @Body() body: DefectCommentDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.defectsService.rejectCompletion(user.id, projectId, defectId, {
      reason: body?.reason,
    });
  }
}
