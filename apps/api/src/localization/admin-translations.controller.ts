import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProjectLocalizationService } from './project-localization.service';

@Controller('v1/admin/translations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminTranslationsController {
  constructor(
    private readonly projectLocalization: ProjectLocalizationService,
  ) {}

  @Post('warm-titles')
  warmTitles() {
    return this.projectLocalization.warmAllProjectTitles();
  }
}
