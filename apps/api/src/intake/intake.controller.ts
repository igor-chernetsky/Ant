import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { SubmitAnswerDto } from '../ai/intake.types';
import { UsersService } from '../users/users.service';
import { IntakeService } from './intake.service';

@Controller('v1/projects/:projectId/intake')
@UseGuards(JwtAuthGuard)
export class IntakeController {
  constructor(
    private readonly intakeService: IntakeService,
    private readonly usersService: UsersService,
  ) {}

  @Post('answer')
  async answer(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
    @Body() body: SubmitAnswerDto,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.intakeService.submitAnswer(user.id, projectId, body);
  }

  @Post('submit')
  async submit(
    @Req() req: Request & { user: JwtPayload },
    @Param('projectId') projectId: string,
  ) {
    const user = await this.usersService.findOrCreateFromJwt(req.user);
    return this.intakeService.submitForProcessing(user.id, projectId);
  }
}
