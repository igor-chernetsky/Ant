import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { ContractorProfilesService } from './contractor-profiles.service';
import {
  RespondInvitationDto,
  SubmitBidDto,
  UpsertContractorProfileDto,
} from './tendering.types';
import { TendersService } from './tenders.service';

@Controller('v1/contractor')
@UseGuards(JwtAuthGuard)
export class ContractorTenderController {
  constructor(
    private readonly tendersService: TendersService,
    private readonly contractorProfiles: ContractorProfilesService,
    private readonly usersService: UsersService,
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

  @Get('invitations')
  async listInvitations(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.resolveUser(req);
    return this.tendersService.listInvitationsForContractor(user.id);
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

  @Post('tenders/:tenderId/invitations/respond')
  async respondInvitation(
    @Req() req: Request & { user: JwtPayload },
    @Param('tenderId') tenderId: string,
    @Body() body: RespondInvitationDto,
  ) {
    const user = await this.resolveUser(req);
    return this.tendersService.respondToInvitation(user.id, tenderId, body);
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
