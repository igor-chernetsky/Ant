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
import { resolveLocaleFromRequest } from '../localization/request-locale';
import { UsersService } from '../users/users.service';
import {
  CompleteProjectDto,
  CreateProjectDto,
  PresignProjectReviewAttachmentDto,
} from './projects.types';
import { ProjectsService } from './projects.service';
import { ProjectReviewsService } from './project-reviews.service';

@Controller('v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectReviews: ProjectReviewsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveClient(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get()
  async list(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.resolveClient(req);
    return this.projectsService.listForClient(user.id);
  }

  @Post()
  async create(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: CreateProjectDto,
  ) {
    const user = await this.resolveClient(req);
    const locale = resolveLocaleFromRequest(req, user.preferredLocale);
    return this.projectsService.createForClient(user.id, body, locale);
  }

  @Get(':id')
  async getOne(
    @Req() req: Request & { user: JwtPayload },
    @Param('id') id: string,
  ) {
    const user = await this.resolveClient(req);
    const locale = resolveLocaleFromRequest(req, user.preferredLocale);
    return this.projectsService.getForClient(user.id, id, locale);
  }

  @Delete(':id')
  async deleteOne(
    @Req() req: Request & { user: JwtPayload },
    @Param('id') id: string,
  ) {
    const user = await this.resolveClient(req);
    await this.projectsService.deleteForClient(user.id, id);
    return { ok: true };
  }

  @Post(':id/hide')
  async hide(
    @Req() req: Request & { user: JwtPayload },
    @Param('id') id: string,
  ) {
    const user = await this.resolveClient(req);
    return this.projectsService.hideForClient(user.id, id);
  }

  @Post(':id/unhide')
  async unhide(
    @Req() req: Request & { user: JwtPayload },
    @Param('id') id: string,
  ) {
    const user = await this.resolveClient(req);
    return this.projectsService.unhideForClient(user.id, id);
  }

  @Get(':id/completion')
  async getCompletion(
    @Req() req: Request & { user: JwtPayload },
    @Param('id') id: string,
  ) {
    const user = await this.resolveClient(req);
    return this.projectReviews.getCompletionContext(user.id, id);
  }

  @Post(':id/review-attachments/presign')
  async presignReviewAttachment(
    @Req() req: Request & { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: PresignProjectReviewAttachmentDto,
  ) {
    const user = await this.resolveClient(req);
    return this.projectReviews.presignAttachment(user.id, id, body);
  }

  @Post(':id/review-attachments/:attachmentId/complete')
  async completeReviewAttachment(
    @Req() req: Request & { user: JwtPayload },
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const user = await this.resolveClient(req);
    return this.projectReviews.completeAttachment(user.id, id, attachmentId);
  }

  @Post(':id/close')
  async close(
    @Req() req: Request & { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: CompleteProjectDto,
  ) {
    const user = await this.resolveClient(req);
    return this.projectsService.closeForClient(user.id, id, body);
  }
}
