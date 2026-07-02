import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 24_000;
const MAX_SCREENSHOTS_PER_CALL = 3;

export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  truncated: boolean;
}

export interface PdfPageScreenshot {
  pageNumber: number;
  dataUrl: string;
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

  async getPageCount(buffer: Buffer): Promise<number> {
    if (buffer.byteLength > MAX_PDF_BYTES) {
      return 0;
    }

    try {
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      await parser.destroy();
      return parsed.total ?? parsed.pages?.length ?? 0;
    } catch {
      return 0;
    }
  }

  async extractScreenshots(
    buffer: Buffer,
    options?: {
      maxPages?: number;
      pageNumbers?: number[];
      desiredWidth?: number;
    },
  ): Promise<PdfPageScreenshot[]> {
    if (buffer.byteLength > MAX_PDF_BYTES) {
      this.logger.warn(
        `PDF too large for screenshot extraction (${buffer.byteLength} bytes)`,
      );
      return [];
    }

    const desiredWidth = options?.desiredWidth ?? 1200;
    const pageNumbers = (options?.pageNumbers ?? [])
      .map((page) => Math.floor(page))
      .filter((page) => page >= 1);

    let screenshotParams:
      | { partial: number[]; desiredWidth: number; imageDataUrl: true; imageBuffer: false }
      | { first: number; desiredWidth: number; imageDataUrl: true; imageBuffer: false };

    if (pageNumbers.length > 0) {
      screenshotParams = {
        partial: pageNumbers.slice(0, MAX_SCREENSHOTS_PER_CALL),
        desiredWidth,
        imageDataUrl: true,
        imageBuffer: false,
      };
    } else {
      const maxPages = Math.min(
        Math.max(options?.maxPages ?? MAX_SCREENSHOTS_PER_CALL, 1),
        MAX_SCREENSHOTS_PER_CALL,
      );
      screenshotParams = {
        first: maxPages,
        desiredWidth,
        imageDataUrl: true,
        imageBuffer: false,
      };
    }

    try {
      const parser = new PDFParse({ data: buffer });
      const screenshot = await parser.getScreenshot(screenshotParams);
      await parser.destroy();

      return (screenshot.pages ?? [])
        .filter((page) => typeof page.dataUrl === 'string' && page.dataUrl.length > 0)
        .map((page) => ({
          pageNumber: page.pageNumber,
          dataUrl: page.dataUrl as string,
        }));
    } catch (err) {
      this.logger.warn(
        `PDF screenshot failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }
}
