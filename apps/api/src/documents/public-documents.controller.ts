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
import { DocumentsService } from './documents.service';
import { parseDocumentDownloadVariant } from './documents.types';

@Controller('v1/public/projects/:projectId/documents')
export class PublicDocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.documentsService.listForPublicProject(projectId);
  }

  @Get(':documentId/download-url')
  @UseGuards(OptionalJwtAuthGuard)
  downloadUrl(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Query('variant') variant?: string,
    @Req() req?: Request & { user?: JwtPayload | null },
  ) {
    return this.documentsService.getPublicDownloadUrl(
      projectId,
      documentId,
      parseDocumentDownloadVariant(variant),
      { authenticated: Boolean(req?.user) },
    );
  }
}
