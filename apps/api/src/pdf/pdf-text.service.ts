import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 24_000;

export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  truncated: boolean;
}

@Injectable()
export class PdfTextService {
  private readonly logger = new Logger(PdfTextService.name);

  async extractText(buffer: Buffer): Promise<PdfTextExtractionResult | null> {
    if (buffer.byteLength > MAX_PDF_BYTES) {
      this.logger.warn(
        `PDF too large for text extraction (${buffer.byteLength} bytes)`,
      );
      return null;
    }

    try {
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      await parser.destroy();
      const raw = String(parsed.text ?? '').replace(/\s+/g, ' ').trim();

      if (!raw) {
        return null;
      }

      const truncated = raw.length > MAX_EXTRACTED_CHARS;
      const text = truncated ? raw.slice(0, MAX_EXTRACTED_CHARS) : raw;

      return {
        text,
        pageCount: parsed.total ?? parsed.pages?.length ?? 0,
        truncated,
      };
    } catch (err) {
      this.logger.warn(
        `PDF parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
