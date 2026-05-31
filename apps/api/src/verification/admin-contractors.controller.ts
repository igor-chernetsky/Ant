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
import { ContractorVerificationStatus } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UsersService } from '../users/users.service';
import { AdminContractorsService } from './admin-contractors.service';
import { RejectContractorDto } from './verification.types';

@Controller('v1/admin/contractors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminContractorsController {
  constructor(
    private readonly adminContractors: AdminContractorsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUser(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get()
  list(@Query('status') status?: ContractorVerificationStatus) {
    return this.adminContractors.listContractors(status);
  }

  @Get(':contractorId')
  getOne(@Param('contractorId') contractorId: string) {
    return this.adminContractors.getContractor(contractorId);
  }

  @Post(':contractorId/approve')
  async approve(
    @Req() req: Request & { user: JwtPayload },
    @Param('contractorId') contractorId: string,
  ) {
    const admin = await this.resolveUser(req);
    return this.adminContractors.approveContractor(admin.id, contractorId);
  }

  @Post(':contractorId/reject')
  async reject(
    @Req() req: Request & { user: JwtPayload },
    @Param('contractorId') contractorId: string,
    @Body() body: RejectContractorDto,
  ) {
    const admin = await this.resolveUser(req);
    return this.adminContractors.rejectContractor(
      admin.id,
      contractorId,
      body,
    );
  }

  @Get(':contractorId/documents/:documentId/download-url')
  downloadUrl(
    @Param('contractorId') contractorId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.adminContractors.getDocumentDownloadUrl(
      contractorId,
      documentId,
    );
  }
}
