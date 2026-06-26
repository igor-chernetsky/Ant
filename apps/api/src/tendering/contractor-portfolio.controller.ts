import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { UsersService } from '../users/users.service';
import { ContractorPortfolioService } from './contractor-portfolio.service';
import {
  PresignPortfolioItemDto,
  UpdatePortfolioItemDto,
} from './portfolio.types';

@Controller('v1/contractor/portfolio')
@UseGuards(JwtAuthGuard)
export class ContractorPortfolioController {
  constructor(
    private readonly portfolio: ContractorPortfolioService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUser(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get()
  async list(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.resolveUser(req);
    return this.portfolio.listForContractor(user.id);
  }

  @Post('presign')
  async presign(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: PresignPortfolioItemDto,
  ) {
    const user = await this.resolveUser(req);
    return this.portfolio.presignUpload(user.id, body);
  }

  @Post(':itemId/complete')
  async complete(
    @Req() req: Request & { user: JwtPayload },
    @Param('itemId') itemId: string,
  ) {
    const user = await this.resolveUser(req);
    return this.portfolio.completeUpload(user.id, itemId);
  }

  @Patch(':itemId')
  async update(
    @Req() req: Request & { user: JwtPayload },
    @Param('itemId') itemId: string,
    @Body() body: UpdatePortfolioItemDto,
  ) {
    const user = await this.resolveUser(req);
    return this.portfolio.updateItem(user.id, itemId, body);
  }

  @Delete(':itemId')
  @HttpCode(204)
  async remove(
    @Req() req: Request & { user: JwtPayload },
    @Param('itemId') itemId: string,
  ) {
    const user = await this.resolveUser(req);
    await this.portfolio.deleteItem(user.id, itemId);
  }
}
