import { Module } from '@nestjs/common';
import { LocalizationModule } from '../localization/localization.module';
import { AmendmentFallbackService } from './amendment-fallback.service';
import { BidAnalysisFallbackService } from './bid-analysis-fallback.service';
import { DocumentAnalysisService } from './document-analysis.service';
import { IntakeFallbackService } from './intake-fallback.service';
import { OpenAiAmendmentService } from './openai-amendment.service';
import { OpenAiBidAnalysisService } from './openai-bid-analysis.service';
import { OpenAiClarificationService } from './openai-clarification.service';
import { OpenAiDocumentService } from './openai-document.service';
import { OpenAiIntakeService } from './openai-intake.service';
import { OpenAiScopeSyncService } from './openai-scope-sync.service';
import { ScopeSyncFallbackService } from './scope-sync-fallback.service';
import { PdfTextService } from '../pdf/pdf-text.service';

@Module({
  imports: [LocalizationModule],
  providers: [
    OpenAiIntakeService,
    IntakeFallbackService,
    OpenAiAmendmentService,
    AmendmentFallbackService,
    OpenAiBidAnalysisService,
    BidAnalysisFallbackService,
    OpenAiDocumentService,
    DocumentAnalysisService,
    OpenAiClarificationService,
    OpenAiScopeSyncService,
    ScopeSyncFallbackService,
    PdfTextService,
  ],
  exports: [
    OpenAiIntakeService,
    IntakeFallbackService,
    OpenAiAmendmentService,
    AmendmentFallbackService,
    OpenAiBidAnalysisService,
    BidAnalysisFallbackService,
    DocumentAnalysisService,
    OpenAiClarificationService,
    OpenAiScopeSyncService,
    ScopeSyncFallbackService,
    PdfTextService,
  ],
})
export class AiModule {}
