import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';

@Injectable()
export class HtmlToPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(HtmlToPdfService.name);
  private browserPromise: Promise<Browser> | null = null;

  async render(html: string): Promise<Buffer> {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'load' });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm',
          },
        });
        return Buffer.from(pdf);
      } finally {
        await page.close();
      }
    } catch (err) {
      this.logger.warn(
        `PDF render failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'Unable to generate PDF document. Try again later.',
      );
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer
        .launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        })
        .catch((err) => {
          this.browserPromise = null;
          throw err;
        });
    }

    try {
      return await this.browserPromise;
    } catch {
      this.browserPromise = null;
      throw new ServiceUnavailableException(
        'PDF engine is not available on this server.',
      );
    }
  }

  async onModuleDestroy() {
    if (!this.browserPromise) return;
    try {
      const browser = await this.browserPromise;
      await browser.close();
    } catch {
      /* ignore shutdown errors */
    } finally {
      this.browserPromise = null;
    }
  }
}
