import { Module } from '@nestjs/common';
import { DocumentAnalysisService } from './document-analysis.service';
import { IntakeFallbackService } from './intake-fallback.service';
import { OpenAiDocumentService } from './openai-document.service';
import { OpenAiIntakeService } from './openai-intake.service';

@Module({
  providers: [
    OpenAiIntakeService,
    IntakeFallbackService,
    OpenAiDocumentService,
    DocumentAnalysisService,
  ],
  exports: [
    OpenAiIntakeService,
    IntakeFallbackService,
    DocumentAnalysisService,
  ],
})
export class AiModule {}
