import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { BidMessagesService } from './bid-messages.service';
import { BidAnalysisService } from './bid-analysis.service';
import { BidOffersService } from './bid-offers.service';
import { SendBidMessageDto, SubmitCounterOfferDto } from './tendering.types';
import { TendersService } from './tenders.service';

@Controller('v1/projects/:projectId/tender')
@UseGuards(JwtAuthGuard)
export class ProjectTenderController {
  constructor(
    private readonly tendersService: TendersService,
    private readonly bidAnalysis: BidAnalysisService,
    private readonly bidOffers: BidOffersService,
    private readonly bidMessages: BidMessagesService,
    private readonly usersService: UsersService,
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
}
