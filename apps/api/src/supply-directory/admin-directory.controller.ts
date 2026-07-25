import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupplyDirectoryKind } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupplyDirectoryService } from './supply-directory.service';
import { UpsertDirectoryEntryDto } from './supply-directory.types';

@Controller('v1/admin/directory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminDirectoryController {
  constructor(private readonly directory: SupplyDirectoryService) {}

  @Get()
  list(@Query('kind') kind?: SupplyDirectoryKind) {
    return this.directory.listAdmin(kind);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.directory.getById(id);
  }

  @Post()
  create(@Body() body: UpsertDirectoryEntryDto) {
    return this.directory.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpsertDirectoryEntryDto) {
    return this.directory.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.directory.remove(id);
  }
}
