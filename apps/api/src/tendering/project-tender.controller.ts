import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { resolveLocaleFromRequest } from '../localization/request-locale';
import { UsersService } from '../users/users.service';
import { BidMessagesService } from './bid-messages.service';
import { BidAnalysisService } from './bid-analysis.service';
import { BidOffersService } from './bid-offers.service';
import { SendBidMessageDto, SubmitCounterOfferDto, UpdateBidContractTermsDto, AnswerClarificationQuestionDto, PublishTenderDto, UpdateTenderDeadlineDto } from './tendering.types';
import { PresignClarificationAttachmentDto } from './clarification-attachments.types';
import { TenderClarificationsService } from './tender-clarifications.service';
import { TendersService } from './tenders.service';
import { CommercialProposalService } from './commercial-proposal.service';

@Controller('v1/projects/:projectId/tender')
@UseGuards(JwtAuthGuard)
export class ProjectTenderController {
  constructor(
    private readonly tendersService: TendersService,
    private readonly bidAnalysis: BidAnalysisService,
    private readonly bidOffers: BidOffersService,
    private readonly bidMessages: BidMessagesService,
    private readonly usersService: UsersService,
    private readonly commercialProposal: CommercialProposalService,
    private readonly clarifications: TenderClarificationsService,
  ) {}

  private async resolveUser(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get()
  async getTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    const tender = await this.tendersService.getForProject(user.id, projectId);
    return tender ?? { tender: null };
  }

  @Get('publish-preview')
  async getPublishPreview(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.getPublishPreview(user.id, projectId);
  }

  @Get('contractor-coverage')
  async getContractorCoverage(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.getContractorCoverage(user.id, projectId);
  }

  @Post()
  async createTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: PublishTenderDto,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.createTender(user.id, projectId, body);
  }

  @Post('start')
  async startTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: PublishTenderDto,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.startTender(user.id, projectId, body);
  }

  @Post('revert')
  @HttpCode(204)
  async revertTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    await this.tendersService.revertTenderToEstimated(user.id, projectId);
  }

  @Post('release-award')
  async releaseAward(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.releaseAwardedContractor(user.id, projectId);
  }

  @Patch('deadline')
  async updateTenderDeadline(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: UpdateTenderDeadlineDto,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.updateTenderDeadline(user.id, projectId, body);
  }

  @Get('clarification-questions')
  async listClarificationQuestions(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    const locale = resolveLocaleFromRequest(req, user.preferredLocale);
    return this.clarifications.listForClient(user.id, projectId, locale);
  }

  @Patch('clarification-questions/:questionId')
  async answerClarificationQuestion(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('questionId') questionId: string,
    @Body() body: AnswerClarificationQuestionDto,
  ) {
    const user = await this.resolveUser(req);
    const locale = resolveLocaleFromRequest(req, user.preferredLocale);
    return this.clarifications.answerQuestion(
      user.id,
      projectId,
      questionId,
      body,
      locale,
    );
  }

  @Post('clarification-questions/:questionId/attachments/presign')
  async presignClarificationAttachment(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('questionId') questionId: string,
    @Body() body: PresignClarificationAttachmentDto,
  ) {
    const user = await this.resolveUser(req);
    return this.clarifications.presignAttachment(
      user.id,
      projectId,
      questionId,
      body,
    );
  }

  @Post(
    'clarification-questions/:questionId/attachments/:attachmentId/complete',
  )
  async completeClarificationAttachment(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('questionId') questionId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.clarifications.completeAttachment(
      user.id,
      projectId,
      questionId,
      attachmentId,
    );
  }

  @Get(
    'clarification-questions/:questionId/attachments/:attachmentId/download-url',
  )
  async getClarificationAttachmentDownloadUrl(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('questionId') questionId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.clarifications.getAttachmentDownloadUrl(
      user.id,
      projectId,
      questionId,
      attachmentId,
    );
  }

  @Post(
    'clarification-questions/:questionId/attachments/:attachmentId/delete',
  )
  @HttpCode(204)
  async deleteClarificationAttachment(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('questionId') questionId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const user = await this.resolveUser(req);
    await this.clarifications.deleteAttachment(
      user.id,
      projectId,
      questionId,
      attachmentId,
    );
  }

  @Get('bids/analysis')
  async getBidAnalysis(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.bidAnalysis.getAnalysis(user.id, projectId);
  }

  @Post('bids/analysis')
  async analyzeBids(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.bidAnalysis.analyzeBids(user.id, projectId);
  }

  @Post('bids/:bidId/select')
  async selectBid(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.selectBid(user.id, projectId, bidId);
  }

  @Get('counter-offer-targets')
  async listCounterOfferTargets(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.bidOffers.listPendingCounterOfferTargets(user.id, projectId);
  }

  @Get('bids/:bidId/counter-offers')
  async listCounterOffers(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.bidOffers.listForBid(user.id, bidId, projectId);
  }

  @Post('bids/:bidId/counter-offers')
  async createCounterOffer(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
    @Body() body: SubmitCounterOfferDto,
  ) {
    const user = await this.resolveUser(req);
    return this.bidOffers.createClientCounterOffer(
      user.id,
      projectId,
      bidId,
      body,
    );
  }

  @Get('bids/:bidId/messages')
  async listBidMessages(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.bidMessages.listMessages(user.id, bidId, projectId);
  }

  @Post('bids/:bidId/messages')
  async sendBidMessage(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
    @Body() body: SendBidMessageDto,
  ) {
    const user = await this.resolveUser(req);
    return this.bidMessages.sendMessage(user.id, bidId, body, projectId);
  }

  @Put('bids/:bidId/presence')
  @HttpCode(204)
  async touchBidChatPresence(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
  ) {
    const user = await this.resolveUser(req);
    await this.bidMessages.touchPresence(user.id, bidId, projectId);
  }

  @Patch('bids/:bidId/contract-terms')
  async updateBidContractTerms(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
    @Body() body: UpdateBidContractTermsDto,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.updateBidContractTermsForClient(
      user.id,
      projectId,
      bidId,
      body,
    );
  }

  @Get('bids/:bidId/commercial-proposal/attachments-count')
  async countCommercialProposalAttachments(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
  ) {
    const user = await this.resolveUser(req);
    const count = await this.commercialProposal.countAttachments(
      user.id,
      bidId,
      projectId,
    );
    return { count };
  }

  @Get('bids/:bidId/commercial-proposal')
  async downloadCommercialProposal(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
    @Query('withAttachments') withAttachments: string | undefined,
    @Res() res: Response,
  ) {
    const user = await this.resolveUser(req);
    const locale = resolveLocaleFromRequest(req, user.preferredLocale);
    const includeAttachments =
      withAttachments === '1' || withAttachments === 'true';

    if (includeAttachments) {
      const { zip, fileName } = await this.commercialProposal.renderZip(
        user.id,
        bidId,
        projectId,
        locale,
      );
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.send(zip);
      return;
    }

    const { pdf, fileName } = await this.commercialProposal.renderPdf(
      user.id,
      bidId,
      projectId,
      locale,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.send(pdf);
  }
}
