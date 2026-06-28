import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { BidMessagesService } from './bid-messages.service';
import { BidAnalysisService } from './bid-analysis.service';
import { BidOffersService } from './bid-offers.service';
import { SendBidMessageDto, SubmitCounterOfferDto, UpdateBidContractTermsDto, AnswerClarificationQuestionDto } from './tendering.types';
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

  @Post()
  async createTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.createTender(user.id, projectId);
  }

  @Post('start')
  async startTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.startTender(user.id, projectId);
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

  @Get('clarification-questions')
  async listClarificationQuestions(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.clarifications.listForClient(user.id, projectId);
  }

  @Patch('clarification-questions/:questionId')
  async answerClarificationQuestion(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('questionId') questionId: string,
    @Body() body: AnswerClarificationQuestionDto,
  ) {
    const user = await this.resolveUser(req);
    return this.clarifications.answerQuestion(
      user.id,
      projectId,
      questionId,
      body,
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

  @Get('bids/:bidId/commercial-proposal')
  async downloadCommercialProposal(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('bidId') bidId: string,
    @Res() res: Response,
  ) {
    const user = await this.resolveUser(req);
    const { pdf, fileName } = await this.commercialProposal.renderPdf(
      user.id,
      bidId,
      projectId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.send(pdf);
  }
}
