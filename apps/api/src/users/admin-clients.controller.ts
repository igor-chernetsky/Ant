import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UsersService } from './users.service';
import { AdminClientsService } from './admin-clients.service';

@Controller('v1/admin/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminClientsController {
  constructor(
    private readonly adminClients: AdminClientsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.adminClients.listClients({
      q: q?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      includeDeleted: includeDeleted === '1' || includeDeleted === 'true',
    });
  }

  @Get(':clientId')
  getOne(@Param('clientId') clientId: string) {
    return this.adminClients.getClient(clientId);
  }

  /**
   * Soft-delete a client. Returns the Keycloak subject so the caller can remove
   * the identity there; the platform row is kept so legal history survives.
   */
  @Delete(':clientId')
  async remove(
    @Req() req: Request & { user: JwtPayload },
    @Param('clientId') clientId: string,
  ) {
    const admin = await this.usersService.findOrCreateFromJwt(req.user);
    return this.usersService.softDeleteUser(admin.id, clientId);
  }
}
