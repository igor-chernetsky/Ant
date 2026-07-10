import { Module } from '@nestjs/common';
import { ContentTranslationService } from './content-translation.service';
import { OpenAiTranslationService } from './openai-translation.service';
import { ProjectLocalizationService } from './project-localization.service';

@Module({
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
