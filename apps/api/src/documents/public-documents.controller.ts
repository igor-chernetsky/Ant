import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { hasRole } from '../auth/roles.decorator';
import { UsersService } from '../users/users.service';
import { DocumentsService } from './documents.service';
import { parseDocumentDownloadVariant } from './documents.types';

@Controller('v1/public/projects/:projectId/documents')
export class PublicDocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async list(
    @Param('projectId') projectId: string,
    @Req() req: Request & { user?: JwtPayload | null },
  ) {
    const user = req.user
      ? await this.usersService.findOrCreateFromJwt(req.user)
      : null;
    return this.documentsService.listForPublicProject(projectId, user?.id ?? null, {
      isAdmin: Boolean(req.user && hasRole(req.user, 'admin')),
      isContractorRole: Boolean(req.user && hasRole(req.user, 'contractor')),
      isDesignerRole: Boolean(req.user && hasRole(req.user, 'designer')),
    });
  }

  @Get(':documentId/download-url')
  @UseGuards(OptionalJwtAuthGuard)
  async downloadUrl(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Query('variant') variant?: string,
    @Req() req?: Request & { user?: JwtPayload | null },
  ) {
    const user = req?.user
      ? await this.usersService.findOrCreateFromJwt(req.user)
      : null;
    return this.documentsService.getPublicDownloadUrl(
      projectId,
      documentId,
      parseDocumentDownloadVariant(variant),
      {
        authenticated: Boolean(req?.user),
        userId: user?.id ?? null,
        isAdmin: Boolean(req?.user && hasRole(req.user, 'admin')),
        isContractorRole: Boolean(
          req?.user && hasRole(req.user, 'contractor'),
        ),
        isDesignerRole: Boolean(req?.user && hasRole(req.user, 'designer')),
      },
    );
  }
}
