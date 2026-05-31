import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { ContractorVerificationService } from './contractor-verification.service';
import { PresignContractorDocDto } from './verification.types';

@Controller('v1/contractor/verification')
@UseGuards(JwtAuthGuard)
export class ContractorVerificationController {
  constructor(
    private readonly verification: ContractorVerificationService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUser(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get('documents')
  async listDocuments(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.resolveUser(req);
    return this.verification.listDocuments(user.id);
  }

  @Post('documents/presign')
  async presign(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: PresignContractorDocDto,
  ) {
    const user = await this.resolveUser(req);
    return this.verification.presignUpload(user.id, body);
  }

  @Post('documents/:documentId/complete')
  async complete(
    @Req() req: Request & { user: JwtPayload },
    @Param('documentId') documentId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.verification.completeUpload(user.id, documentId);
  }

  @Get('documents/:documentId/download-url')
  async downloadUrl(
    @Req() req: Request & { user: JwtPayload },
    @Param('documentId') documentId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.verification.getDownloadUrl(user.id, documentId);
  }

  @Post('request-approval')
  async requestApproval(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.resolveUser(req);
    return this.verification.requestApproval(user.id);
  }
}
