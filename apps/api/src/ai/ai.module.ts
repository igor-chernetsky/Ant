import { Module } from '@nestjs/common';
import { AmendmentFallbackService } from './amendment-fallback.service';
import { BidAnalysisFallbackService } from './bid-analysis-fallback.service';
import { DocumentAnalysisService } from './document-analysis.service';
import { IntakeFallbackService } from './intake-fallback.service';
import { OpenAiAmendmentService } from './openai-amendment.service';
import { OpenAiBidAnalysisService } from './openai-bid-analysis.service';
import { OpenAiDocumentService } from './openai-document.service';
import { OpenAiIntakeService } from './openai-intake.service';

@Module({
  providers: [
    OpenAiIntakeService,
    IntakeFallbackService,
    OpenAiAmendmentService,
    AmendmentFallbackService,
    OpenAiBidAnalysisService,
    BidAnalysisFallbackService,
    OpenAiDocumentService,
    DocumentAnalysisService,
  ],
  exports: [
    OpenAiIntakeService,
    IntakeFallbackService,
    OpenAiAmendmentService,
    AmendmentFallbackService,
    OpenAiBidAnalysisService,
    BidAnalysisFallbackService,
    DocumentAnalysisService,
  ],
})
export class AiModule {}
