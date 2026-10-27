import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SubmitAnswerDto } from '../ai/intake.types';
import { DocumentsService } from '../documents/documents.service';
import {
  parseDocumentDownloadVariant,
  PresignUploadDto,
} from '../documents/documents.types';
import { IntakeService } from '../intake/intake.service';
import { resolveLocaleFromRequest } from '../localization/request-locale';
import { guestViewer } from './project-viewer';
import { GuestProjectGuard } from './guest-project.guard';
import { GuestProjectQuotaService } from './guest-project-quota.service';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.types';

/**
 * Project workspace for an anonymous visitor.
 *
 * Anyone may fill a project in, answer the intake and attach documents before
 * registering. The token issued by `POST /v1/guest/projects` authorizes the
 * guest on every other route here; publishing for bids is intentionally absent —
 * it needs a claimed project, so the client registers first.
 */
@Controller('v1/guest/projects')
export class GuestProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly intakeService: IntakeService,
    private readonly documentsService: DocumentsService,
    private readonly quota: GuestProjectQuotaService,
  ) {}

  @Post()
  async create(@Req() req: Request, @Body() body: CreateProjectDto) {
    const ip = clientIp(req);
    const quota = this.quota.consume(ip);
    if (!quota.ok) {
      throw new BadRequestException(
        'Too many projects started from this connection. Try again later.',
      );
    }

    const locale = resolveLocaleFromRequest(req, null);
    // The first question set may use the model; `GUEST_AI_QUESTION_LIMIT` and the
    // per-IP project cap bound what an anonymous visitor can spend.
    const { project, guestToken } = await this.projectsService.createForGuest(
      body,
      locale,
      { allowAi: true, connectionKey: ip },
    );

    return { project, guestToken };
  }

  @Get(':projectId')
  @UseGuards(GuestProjectGuard)
  async get(@Req() req: Request, @Param('projectId') projectId: string) {
    const locale = resolveLocaleFromRequest(req, null);
    return this.projectsService.getForViewer(
      guestViewer(projectId),
      projectId,
      locale,
    );
  }

  @Patch(':projectId')
  @UseGuards(GuestProjectGuard)
  async update(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectDto,
  ) {
    const locale = resolveLocaleFromRequest(req, null);
    return this.projectsService.updateCardForViewer(
      guestViewer(projectId),
      projectId,
      body,
      locale,
    );
  }

  /**
   * Tie the draft to the address the visitor is registering with, so a lost
   * cookie or a confirmation link opened on another device no longer loses it.
   */
  @Post(':projectId/claim-email')
  @UseGuards(GuestProjectGuard)
  async tagClaimEmail(
    @Param('projectId') projectId: string,
    @Body() body: { email?: string },
  ) {
    return this.projectsService.tagGuestProjectClaimEmail(
      projectId,
      body?.email ?? '',
    );
  }

  @Delete(':projectId')
  @UseGuards(GuestProjectGuard)
  async remove(@Param('projectId') projectId: string) {
    await this.projectsService.deleteForViewer(
      guestViewer(projectId),
      projectId,
    );
    return { ok: true };
  }

  @Post(':projectId/intake/answer')
  @UseGuards(GuestProjectGuard)
  async answer(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body() body: SubmitAnswerDto,
  ) {
    const locale = resolveLocaleFromRequest(req, null);
    return this.intakeService.submitAnswerForViewer(
      guestViewer(projectId),
      projectId,
      body,
      locale,
    );
  }

  @Post(':projectId/intake/submit')
  @UseGuards(GuestProjectGuard)
  async submitIntake(
    @Req() req: Request,
    @Param('projectId') projectId: string,
  ) {
    const locale = resolveLocaleFromRequest(req, null);
    return this.intakeService.submitForProcessingForViewer(
      guestViewer(projectId),
      projectId,
      locale,
    );
  }

  @Get(':projectId/documents')
  @UseGuards(GuestProjectGuard)
  async listDocuments(@Param('projectId') projectId: string) {
    return this.documentsService.listForViewer(
      guestViewer(projectId),
      projectId,
    );
  }

  @Post(':projectId/documents/presign')
  @UseGuards(GuestProjectGuard)
  async presignDocument(
    @Param('projectId') projectId: string,
    @Body() body: PresignUploadDto,
  ) {
    return this.documentsService.presignUploadForViewer(
      guestViewer(projectId),
      projectId,
      body,
    );
  }

  @Post(':projectId/documents/:documentId/complete')
  @UseGuards(GuestProjectGuard)
  async completeDocument(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.completeUploadForViewer(
      guestViewer(projectId),
      projectId,
      documentId,
    );
  }

  @Get(':projectId/documents/:documentId/download-url')
  @UseGuards(GuestProjectGuard)
  async documentDownloadUrl(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Query('variant') variant?: string,
  ) {
    return this.documentsService.getDownloadUrlForViewer(
      guestViewer(projectId),
      projectId,
      documentId,
      parseDocumentDownloadVariant(variant),
    );
  }

  @Delete(':projectId/documents/:documentId')
  @UseGuards(GuestProjectGuard)
  async deleteDocument(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
  ) {
    await this.documentsService.deleteDocumentForViewer(
      guestViewer(projectId),
      projectId,
      documentId,
    );
    return { ok: true };
  }
}

/**
 * Client IP for the anonymous quota. The BFF forwards the browser's address in
 * `x-forwarded-for`, so a direct API call can spoof it — the quota is a cost
 * guard, not an authorization decision.
 */
function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const fromHeader = first?.split(',')[0]?.trim();
  return fromHeader || req.ip || 'unknown';
}
