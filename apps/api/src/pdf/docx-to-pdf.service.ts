import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { HtmlToPdfService } from '../pdf/html-to-pdf.service';

/** Cap on decompressed DOCX→HTML size to blunt zip-ratio bombs. */
const MAX_CONVERTED_HTML_LENGTH = 8 * 1024 * 1024;

@Injectable()
export class DocxToPdfService {
  private readonly logger = new Logger(DocxToPdfService.name);

  constructor(private readonly htmlToPdf: HtmlToPdfService) {}

  async convert(docxBuffer: Buffer): Promise<Buffer> {
    if (!docxBuffer?.length) {
      throw new BadRequestException('DOCX file is empty');
    }

    let bodyHtml: string;
    try {
      const result = await mammoth.convertToHtml({ buffer: docxBuffer });
      bodyHtml = result.value?.trim() || '<p></p>';
      if (bodyHtml.length > MAX_CONVERTED_HTML_LENGTH) {
        throw new BadRequestException(
          'DOCX content is too large to convert. Try uploading a PDF instead.',
        );
      }
      if (result.messages?.length) {
        this.logger.debug(
          `DOCX conversion notes: ${result.messages
            .map((m) => m.message)
            .join('; ')
            .slice(0, 500)}`,
        );
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.warn(
        `DOCX→HTML failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(
        'Could not convert DOCX to PDF. Try uploading a PDF instead.',
      );
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #111;
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; margin: 0.75em 0; }
    th, td { border: 1px solid #cbd5e1; padding: 0.35em 0.5em; vertical-align: top; }
    th { background: #f1f5f9; text-align: left; }
    p { margin: 0 0 0.65em; }
    h1, h2, h3 { margin: 0.9em 0 0.45em; line-height: 1.25; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;

    return this.htmlToPdf.render(html);
  }
}
