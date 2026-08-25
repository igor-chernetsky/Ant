import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminClientsService } from './admin-clients.service';

@Controller('v1/admin/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminClientsController {
  constructor(private readonly adminClients: AdminClientsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminClients.listClients({
      q: q?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':clientId')
  getOne(@Param('clientId') clientId: string) {
    return this.adminClients.getClient(clientId);
  }
}
