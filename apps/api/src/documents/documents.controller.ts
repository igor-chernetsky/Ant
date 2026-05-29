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
import { DocumentsService } from './documents.service';
import { PresignUploadDto } from './documents.types';

@Controller('v1/projects/:projectId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUser(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get()
  async list(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.documentsService.listForProject(projectId, user.id);
  }

  @Post('presign')
  async presign(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: PresignUploadDto,
  ) {
    const user = await this.resolveUser(req);
    return this.documentsService.presignUpload(projectId, user.id, body);
  }

  @Post(':documentId/complete')
  async complete(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.documentsService.completeUpload(
      projectId,
      documentId,
      user.id,
    );
  }

  @Get(':documentId/download-url')
  async downloadUrl(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.documentsService.getDownloadUrl(
      projectId,
      documentId,
      user.id,
    );
  }
}
