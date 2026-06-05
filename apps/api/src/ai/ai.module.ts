import { Module } from '@nestjs/common';
import { AmendmentFallbackService } from './amendment-fallback.service';
import { DocumentAnalysisService } from './document-analysis.service';
import { IntakeFallbackService } from './intake-fallback.service';
import { OpenAiAmendmentService } from './openai-amendment.service';
import { OpenAiDocumentService } from './openai-document.service';
import { OpenAiIntakeService } from './openai-intake.service';

@Module({
  providers: [
    OpenAiIntakeService,
    IntakeFallbackService,
    OpenAiAmendmentService,
    AmendmentFallbackService,
    OpenAiDocumentService,
    DocumentAnalysisService,
  ],
  exports: [
    OpenAiIntakeService,
    IntakeFallbackService,
    OpenAiAmendmentService,
    AmendmentFallbackService,
    DocumentAnalysisService,
  ],
})
export class AiModule {}
