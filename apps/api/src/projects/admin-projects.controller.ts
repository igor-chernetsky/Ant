import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProjectsService } from './projects.service';

@Controller('v1/admin/projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Delete(':id')
  async deleteOne(@Param('id') id: string) {
    await this.projectsService.deleteForAdmin(id);
    return { ok: true };
  }
}
