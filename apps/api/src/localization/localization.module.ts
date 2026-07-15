import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminTranslationsController } from './admin-translations.controller';
import { ContentTranslationService } from './content-translation.service';
import { OpenAiTranslationService } from './openai-translation.service';
import { ProjectLocalizationService } from './project-localization.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminTranslationsController],
  providers: [
    OpenAiTranslationService,
    ContentTranslationService,
    ProjectLocalizationService,
  ],
  exports: [
    OpenAiTranslationService,
    ContentTranslationService,
    ProjectLocalizationService,
  ],
})
export class LocalizationModule {}
