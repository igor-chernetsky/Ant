import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';

const RENDER_TIMEOUT_MS = 30_000;
const MAX_CONCURRENT_RENDERS = 2;

@Injectable()
export class HtmlToPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(HtmlToPdfService.name);
  private browserPromise: Promise<Browser> | null = null;
  private activeRenders = 0;
  private readonly renderQueue: Array<() => void> = [];

  async render(html: string): Promise<Buffer> {
    await this.acquireRenderSlot();

    let page: Page | null = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      // Defense in depth: contract HTML must never execute scripts in PDF render.
      await page.setJavaScriptEnabled(false);
      // Block remote resources — signed PDFs must not fetch external images,
      // fonts or tracking pixels during render. Allow only data:/about: URLs
      // (embedded base64 images from contract/broadcast editors).
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (/^https?:/i.test(request.url())) {
          void request.abort();
        } else {
          void request.continue();
        }
      });

      const renderPromise = (async () => {
        await page!.setContent(html, { waitUntil: 'load' });
        return Buffer.from(
          await page!.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
              top: '20mm',
              right: '15mm',
              bottom: '20mm',
              left: '15mm',
            },
          }),
        );
      })();

      return await this.withTimeout(renderPromise, page);
    } catch (err) {
      this.logger.warn(
        `PDF render failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'Unable to generate PDF document. Try again later.',
      );
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch(() => undefined);
      }
      this.releaseRenderSlot();
    }
  }

  private async withTimeout(
    promise: Promise<Buffer>,
    page: Page,
  ): Promise<Buffer> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('PDF render timed out')),
        RENDER_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private acquireRenderSlot(): Promise<void> {
    if (this.activeRenders < MAX_CONCURRENT_RENDERS) {
      this.activeRenders += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.renderQueue.push(() => {
        this.activeRenders += 1;
        resolve();
      });
    });
  }

  private releaseRenderSlot(): void {
    this.activeRenders -= 1;
    const next = this.renderQueue.shift();
    if (next) {
      next();
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
