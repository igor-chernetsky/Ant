import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { BidMessagesService } from './bid-messages.service';
import { BidOffersService } from './bid-offers.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import {
  SendBidMessageDto,
  SubmitBidDto,
  UpsertContractorProfileDto,
} from './tendering.types';
import { TendersService } from './tenders.service';
import { CommercialProposalService } from './commercial-proposal.service';

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
  ) {}

  private async resolveUser(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
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

  @Get('bids/:bidId/commercial-proposal')
  async downloadCommercialProposal(
    @Req() req: Request & { user: JwtPayload },
    @Param('bidId') bidId: string,
    @Res() res: Response,
  ) {
    const user = await this.resolveUser(req);
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
