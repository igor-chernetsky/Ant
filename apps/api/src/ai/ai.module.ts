import { Module } from '@nestjs/common';
import { IntakeFallbackService } from './intake-fallback.service';
import { OpenAiIntakeService } from './openai-intake.service';

@Module({
  providers: [OpenAiIntakeService, IntakeFallbackService],
  exports: [OpenAiIntakeService, IntakeFallbackService],
})
export class AiModule {}
