import { Controller, Get, Param } from '@nestjs/common';
import { DocumentsService } from './documents.service';

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
  ) {
    return this.documentsService.getPublicDownloadUrl(projectId, documentId);
  }
}
