import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { ContractsService } from './contracts.service';
import type { SignContractDto, UpdateContractDocumentDto } from './contracts.types';

@Controller('v1/projects/:projectId/contract')
@UseGuards(JwtAuthGuard)
export class ProjectContractController {
  constructor(
    private readonly contracts: ContractsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUser(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get()
  async getContract(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.resolveUser(req);
    const contract = await this.contracts.getForProject(user.id, projectId);
    return contract ?? { contract: null };
  }

  @Patch('document')
  @HttpCode(200)
  async updateDocument(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: UpdateContractDocumentDto,
  ) {
    const user = await this.resolveUser(req);
    return this.contracts.updateDocument(user.id, projectId, body);
  }

  @Post('sign')
  @HttpCode(200)
  async signContract(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: SignContractDto,
  ) {
    const user = await this.resolveUser(req);
    return this.contracts.signForProject(user.id, projectId, body ?? {});
  }
}