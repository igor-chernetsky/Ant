import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ContractSignatureRequestStatus } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UsersService } from '../users/users.service';
import { SignatureRequestsService } from './signature-requests.service';
import type { RejectSignatureRequestDto } from './signature-requests.types';

@Controller('v1/admin/signature-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSignatureRequestsController {
  constructor(
    private readonly signatureRequests: SignatureRequestsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUser(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get()
  list(@Query('status') status?: ContractSignatureRequestStatus | '') {
    return this.signatureRequests.listForAdmin(status);
  }

  @Post(':requestId/approve')
  async approve(
    @Req() req: Request & { user: JwtPayload },
    @Param('requestId') requestId: string,
  ) {
    const admin = await this.resolveUser(req);
    return this.signatureRequests.approve(admin.id, requestId);
  }

  @Post(':requestId/reject')
  async reject(
    @Req() req: Request & { user: JwtPayload },
    @Param('requestId') requestId: string,
    @Body() body: RejectSignatureRequestDto,
  ) {
    const admin = await this.resolveUser(req);
    return this.signatureRequests.reject(admin.id, requestId, body);
  }
}
