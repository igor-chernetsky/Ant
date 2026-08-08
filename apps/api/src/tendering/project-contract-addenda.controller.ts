import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { ContractAddendaService } from './contract-addenda.service';
import type {
  CreateAddendumFromFileDto,
  CreateAddendumFromTextDto,
  PresignAddendumAttachmentDto,
  PresignAddendumFileDto,
  RegenerateAddendumDto,
  SignAddendumDto,
  UpdateAddendumDocumentDto,
} from './contract-addenda.types';

@Controller('v1/projects/:projectId/contract/addenda')
@UseGuards(JwtAuthGuard)
export class ProjectContractAddendaController {
  constructor(
    private readonly addenda: ContractAddendaService,
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
    return this.addenda.list(user.id, projectId);
  }

  @Get(':addendumId/download')
  async download(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
    @Query('withAttachments') withAttachments: string | undefined,
    @Query('formats') formatsQuery: string | string[] | undefined,
    @Query('includeSignatures') includeSignaturesQuery: string | undefined,
    @Res() res: Response,
  ) {
    const user = await this.resolveUser(req);
    const includeAttachments =
      withAttachments === '1' || withAttachments === 'true';
    const includeSignatures =
      includeSignaturesQuery === '1' || includeSignaturesQuery === 'true';
    const formats = Array.isArray(formatsQuery)
      ? formatsQuery
      : typeof formatsQuery === 'string'
        ? formatsQuery.split(/[,\s]+/)
        : undefined;
    const { buffer, fileName, contentType } = await this.addenda.renderDownload(
      user.id,
      projectId,
      addendumId,
      {
        withAttachments: includeAttachments,
        formats,
        includeSignatures,
      },
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }

  @Get(':addendumId')
  async get(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.get(user.id, projectId, addendumId);
  }

  @Delete(':addendumId')
  @HttpCode(200)
  async remove(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
  ) {
    const user = await this.resolveUser(req);
    await this.addenda.delete(user.id, projectId, addendumId);
    return { ok: true };
  }

  @Post('from-text')
  @HttpCode(200)
  async createFromText(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: CreateAddendumFromTextDto,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.createFromText(user.id, projectId, body);
  }

  @Post('from-file/presign')
  async presignCreate(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: PresignAddendumFileDto,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.presignCreateFile(user.id, projectId, body);
  }

  @Post('from-file/complete')
  @HttpCode(200)
  async completeCreate(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: CreateAddendumFromFileDto & { addendumId?: string },
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.createFromFile(user.id, projectId, body);
  }

  @Patch(':addendumId/document')
  @HttpCode(200)
  async updateDocument(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
    @Body() body: UpdateAddendumDocumentDto,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.updateDocument(user.id, projectId, addendumId, body);
  }

  @Post(':addendumId/document/regenerate')
  @HttpCode(200)
  async regenerate(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
    @Body() body: RegenerateAddendumDto,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.regenerateFromDescription(
      user.id,
      projectId,
      addendumId,
      body ?? {},
    );
  }

  @Post(':addendumId/custom-file/presign')
  async presignReplace(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
    @Body() body: PresignAddendumFileDto,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.presignReplaceFile(
      user.id,
      projectId,
      addendumId,
      body,
    );
  }

  @Post(':addendumId/custom-file/complete')
  @HttpCode(200)
  async completeReplace(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
    @Body() body: CreateAddendumFromFileDto,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.completeReplaceFile(
      user.id,
      projectId,
      addendumId,
      body,
    );
  }

  @Get(':addendumId/custom-file')
  async downloadFile(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.getFileDownloadUrl(user.id, projectId, addendumId);
  }

  @Post(':addendumId/attachments/presign')
  async presignAttachment(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
    @Body() body: PresignAddendumAttachmentDto,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.presignAttachment(
      user.id,
      projectId,
      addendumId,
      body,
    );
  }

  @Post(':addendumId/attachments/:attachmentId/complete')
  @HttpCode(200)
  async completeAttachment(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.completeAttachment(
      user.id,
      projectId,
      addendumId,
      attachmentId,
    );
  }

  @Post(':addendumId/attachments/:attachmentId/delete')
  @HttpCode(200)
  async deleteAttachment(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const user = await this.resolveUser(req);
    await this.addenda.deleteAttachment(
      user.id,
      projectId,
      addendumId,
      attachmentId,
    );
    return { ok: true };
  }

  @Get(':addendumId/attachments/:attachmentId/download-url')
  async attachmentDownloadUrl(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.getAttachmentDownloadUrl(
      user.id,
      projectId,
      addendumId,
      attachmentId,
    );
  }

  @Post(':addendumId/sign')
  @HttpCode(200)
  async sign(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('addendumId') addendumId: string,
    @Body() body: SignAddendumDto,
  ) {
    const user = await this.resolveUser(req);
    return this.addenda.sign(user.id, projectId, addendumId, body ?? {});
  }
}
