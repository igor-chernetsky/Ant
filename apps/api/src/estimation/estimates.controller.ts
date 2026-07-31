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
import { resolveLocaleFromRequest } from '../localization/request-locale';
import { UsersService } from '../users/users.service';
import { EstimatesService } from './estimates.service';

@Controller('v1/projects/:projectId/estimate')
@UseGuards(JwtAuthGuard)
export class EstimatesController {
  constructor(
    private readonly estimatesService: EstimatesService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async getLatest(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    const locale = resolveLocaleFromRequest(req, user.preferredLocale);
    const estimate = await this.estimatesService.getLatestForProject(
      user.id,
      projectId,
      locale,
    );
    return estimate ?? { estimate: null };
  }

  @Post('refine')
  async refine(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body()
    body: {
      answers?: Array<{
        question?: string;
        answer?: string;
        questionIndex?: number;
      }>;
    },
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    const locale = resolveLocaleFromRequest(req, user.preferredLocale);
    return this.estimatesService.refineAndRegenerate(
      user.id,
      projectId,
      Array.isArray(body?.answers)
        ? body.answers.map((row) => ({
            question: row.question ?? '',
            answer: row.answer ?? '',
            questionIndex:
              typeof row.questionIndex === 'number'
                ? row.questionIndex
                : undefined,
          }))
        : [],
      locale,
    );
  }
}
