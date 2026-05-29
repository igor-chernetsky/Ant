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
import { CreateProjectDto } from './projects.types';
import { ProjectsService } from './projects.service';

@Controller('v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveClient(req: Request & { user: JwtPayload }) {
    return this.usersService.findOrCreateFromJwt(req.user);
  }

  @Get()
  async list(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.resolveClient(req);
    return this.projectsService.listForClient(user.id);
  }

  @Post()
  async create(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: CreateProjectDto,
  ) {
    const user = await this.resolveClient(req);
    return this.projectsService.createForClient(user.id, body);
  }

  @Get(':id')
  async getOne(
    @Req() req: Request & { user: JwtPayload },
    @Param('id') id: string,
  ) {
    const user = await this.resolveClient(req);
    return this.projectsService.getForClient(user.id, id);
  }
}
