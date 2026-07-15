import { Controller, Get, Param, Query } from '@nestjs/common';
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
  downloadUrl(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Query('variant') variant?: string,
  ) {
    return this.documentsService.getPublicDownloadUrl(
      projectId,
      documentId,
      parseDocumentDownloadVariant(variant),
    );
  }
}
