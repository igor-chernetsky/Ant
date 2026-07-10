import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { resolveLocaleFromRequest } from '../localization/request-locale';
import { UsersService } from '../users/users.service';
import { BidMessagesService } from './bid-messages.service';
import { BidOffersService } from './bid-offers.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import {
  SendBidMessageDto,
  SubmitBidDto,
  SubmitBidClarificationQuestionsDto,
  UpsertContractorProfileDto,
} from './tendering.types';
import { TenderClarificationsService } from './tender-clarifications.service';
import { TendersService } from './tenders.service';
import { CommercialProposalService } from './commercial-proposal.service';
import { ContractsService } from './contracts.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectReviewsService } from '../projects/project-reviews.service';

@Controller('v1/contractor')
@UseGuards(JwtAuthGuard)
export class ContractorTenderController {
  constructor(
    private readonly tendersService: TendersService,
    private readonly bidMessages: BidMessagesService,
    private readonly bidOffers: BidOffersService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly usersService: UsersService,
    private readonly commercialProposal: CommercialProposalService,
    private readonly clarifications: TenderClarificationsService,
    private readonly projectsService: ProjectsService,
    private readonly projectReviews: ProjectReviewsService,
    private readonly contracts: ContractsService,
  ) {}

  private async resolveUser(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get('projects/:projectId/view')
  async getParticipantProjectView(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    const locale = resolveLocaleFromRequest(req, user.preferredLocale);
    return this.projectsService.getPublicByIdForParticipant(user.id, projectId, locale);
  }

  @Get('profile')
  async getProfile(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.resolveUser(req);
    const profile = await this.contractorProfiles.getByUserId(user.id);
    return profile ?? { profile: null };
  }

  @Put('profile')
  async upsertProfile(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: UpsertContractorProfileDto,
  ) {
    const user = await this.resolveUser(req);
    return this.contractorProfiles.upsertForUser(user.id, body);
  }

  @Get('applications')
  async listApplications(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.resolveUser(req);
    return this.tendersService.listApplicationsForContractor(user.id);
  }

  @Get('reviews')
  async listReviews(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.resolveUser(req);
    return this.projectReviews.listForContractor(user.id);
  }

  @Get('invitations')
  async listInvitations(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.resolveUser(req);
    return this.tendersService.listApplicationsForContractor(user.id);
  }

  @Get('bids/:bidId/messages')
  async listBidMessages(
    @Req() req: Request & { user: JwtPayload },
    @Param('bidId') bidId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.bidMessages.listMessages(user.id, bidId);
  }

  @Post('bids/:bidId/messages')
  async sendBidMessage(
    @Req() req: Request & { user: JwtPayload },
    @Param('bidId') bidId: string,
    @Body() body: SendBidMessageDto,
  ) {
    const user = await this.resolveUser(req);
    return this.bidMessages.sendMessage(user.id, bidId, body);
  }

  @Put('bids/:bidId/presence')
  @HttpCode(204)
  async touchBidChatPresence(
    @Req() req: Request & { user: JwtPayload },
    @Param('bidId') bidId: string,
  ) {
    const user = await this.resolveUser(req);
    await this.bidMessages.touchPresence(user.id, bidId);
  }

  @Get('bids/:bidId/commercial-proposal/attachments-count')
  async countCommercialProposalAttachments(
    @Req() req: Request & { user: JwtPayload },
    @Param('bidId') bidId: string,
  ) {
    const user = await this.resolveUser(req);
    const count = await this.commercialProposal.countAttachments(
      user.id,
      bidId,
    );
    return { count };
  }

  @Get('bids/:bidId/commercial-proposal')
  async downloadCommercialProposal(
    @Req() req: Request & { user: JwtPayload },
    @Param('bidId') bidId: string,
    @Query('withAttachments') withAttachments: string | undefined,
    @Res() res: Response,
  ) {
    const user = await this.resolveUser(req);
    const includeAttachments =
      withAttachments === '1' || withAttachments === 'true';

    if (includeAttachments) {
      const { zip, fileName } = await this.commercialProposal.renderZip(
        user.id,
        bidId,
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
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.send(pdf);
  }

  @Get('projects/:projectId/participation')
  async getProjectParticipation(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    const participation = await this.tendersService.getParticipationForProject(
      user.id,
      projectId,
    );
    return participation ?? { participation: null };
  }

  @Get('projects/:projectId/contract')
  async getContract(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    const contract = await this.contracts.getForProject(user.id, projectId);
    return contract ?? { contract: null };
  }

  @Post('projects/:projectId/contract/sign')
  @HttpCode(200)
  async signContract(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.contracts.signForProject(user.id, projectId);
  }

  @Get('projects/:projectId/clarification-attachments')
  async listClarificationAttachments(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.clarifications.listAnswerAttachmentsForContractor(
      user.id,
      projectId,
    );
  }

  @Get(
    'projects/:projectId/clarification-questions/:questionId/attachments/:attachmentId/download-url',
  )
  async getClarificationAttachmentDownloadUrl(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Param('questionId') questionId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.clarifications.getAttachmentDownloadUrlForContractor(
      user.id,
      projectId,
      questionId,
      attachmentId,
    );
  }

  @Get('tenders/:tenderId')
  async getTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('tenderId') tenderId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.getTenderForContractor(user.id, tenderId);
  }

  @Post('tenders/:tenderId/clarify')
  async startClarification(
    @Req() req: Request & { user: JwtPayload },
    @Param('tenderId') tenderId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.startClarification(user.id, tenderId);
  }

  @Get('bids/:bidId/clarification-questions')
  async getBidClarificationQuestions(
    @Req() req: Request & { user: JwtPayload },
    @Param('bidId') bidId: string,
  ) {
    const user = await this.resolveUser(req);
    const submission = await this.clarifications.getSubmissionForContractor(
      user.id,
      bidId,
    );
    return submission ?? { submission: null };
  }

  @Post('bids/:bidId/clarification-questions')
  async submitBidClarificationQuestions(
    @Req() req: Request & { user: JwtPayload },
    @Param('bidId') bidId: string,
    @Body() body: SubmitBidClarificationQuestionsDto,
  ) {
    const user = await this.resolveUser(req);
    return this.clarifications.submitBidQuestions(user.id, bidId, body);
  }

  @Post('tenders/:tenderId/enroll')
  async enrollInTender(
    @Req() req: Request & { user: JwtPayload },
    @Param('tenderId') tenderId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.enrollInTender(user.id, tenderId);
  }

  @Post('tenders/:tenderId/bids')
  async submitBid(
    @Req() req: Request & { user: JwtPayload },
    @Param('tenderId') tenderId: string,
    @Body() body: SubmitBidDto,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.submitBid(user.id, tenderId, body);
  }

  @Delete('tenders/:tenderId/bids')
  async withdrawBid(
    @Req() req: Request & { user: JwtPayload },
    @Param('tenderId') tenderId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.withdrawBid(user.id, tenderId);
  }
}
