import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SupportedLocale } from '../users/locale.types';
import {
  hashSourceText,
  OpenAiTranslationService,
} from './openai-translation.service';

@Injectable()
export class ContentTranslationService {
  private readonly logger = new Logger(ContentTranslationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiTranslationService,
  ) {}

  async getCachedText(input: {
    projectId: string;
    fieldKey: string;
    sourceText: string;
    targetLocale: SupportedLocale;
  }): Promise<string | null> {
    const { projectId, fieldKey, sourceText, targetLocale } = input;
    if (!sourceText.trim()) {
      return sourceText;
    }

    const cached = await this.prisma.contentTranslation.findUnique({
      where: {
        projectId_fieldKey_targetLocale: {
          projectId,
          fieldKey,
          targetLocale,
        },
      },
    });

    if (cached && cached.sourceHash === hashSourceText(sourceText)) {
      return cached.translatedText;
    }

    return null;
  }

  async getCachedJson<T>(input: {
    projectId: string;
    fieldKey: string;
    sourceValue: T;
    targetLocale: SupportedLocale;
  }): Promise<T | null> {
    const { projectId, fieldKey, sourceValue, targetLocale } = input;
    const serialized = JSON.stringify(sourceValue);
    if (!serialized || serialized === '{}' || serialized === 'null') {
      return sourceValue;
    }

    const cached = await this.prisma.contentTranslation.findUnique({
      where: {
        projectId_fieldKey_targetLocale: {
          projectId,
          fieldKey,
          targetLocale,
        },
      },
    });

    if (cached && cached.sourceHash === hashSourceText(serialized)) {
      try {
        return JSON.parse(cached.translatedText) as T;
      } catch {
        return null;
      }
    }

    return null;
  }

  async translateAndCacheText(input: {
    projectId: string;
    fieldKey: string;
    sourceText: string;
    sourceLocale: SupportedLocale;
    targetLocale: SupportedLocale;
  }): Promise<string> {
    const { projectId, fieldKey, sourceText, sourceLocale, targetLocale } =
      input;

    if (!sourceText.trim() || sourceLocale === targetLocale) {
      return sourceText;
    }

    const sourceHash = hashSourceText(sourceText);
    const cached = await this.prisma.contentTranslation.findUnique({
      where: {
        projectId_fieldKey_targetLocale: {
          projectId,
          fieldKey,
          targetLocale,
        },
      },
    });

    if (cached && cached.sourceHash === sourceHash) {
      return cached.translatedText;
    }

    const translated = await this.openAi.translateText(
      sourceText,
      sourceLocale,
      targetLocale,
    );
    if (translated == null) {
      this.logger.warn(
        `Skipping cache for ${projectId}/${fieldKey}→${targetLocale}: translation unavailable`,
      );
      return sourceText;
    }

    await this.upsertTranslation({
      projectId,
      fieldKey,
      targetLocale,
      sourceLocale,
      sourceHash,
      translatedText: translated,
    });

    return translated;
  }

  async translateAndCacheJson<T>(input: {
    projectId: string;
    fieldKey: string;
    sourceValue: T;
    sourceLocale: SupportedLocale;
    targetLocale: SupportedLocale;
  }): Promise<T> {
    const { projectId, fieldKey, sourceValue, sourceLocale, targetLocale } =
      input;

    if (sourceLocale === targetLocale) {
      return sourceValue;
    }

    const serialized = JSON.stringify(sourceValue);
    if (!serialized || serialized === '{}' || serialized === 'null') {
      return sourceValue;
    }

    const sourceHash = hashSourceText(serialized);
    const cached = await this.prisma.contentTranslation.findUnique({
      where: {
        projectId_fieldKey_targetLocale: {
          projectId,
          fieldKey,
          targetLocale,
        },
      },
    });

    if (cached && cached.sourceHash === sourceHash) {
      try {
        return JSON.parse(cached.translatedText) as T;
      } catch {
        // re-translate below
      }
    }

    const translated = await this.openAi.translateJson(
      sourceValue,
      sourceLocale,
      targetLocale,
    );
    if (translated == null) {
      this.logger.warn(
        `Skipping cache for ${projectId}/${fieldKey}→${targetLocale}: JSON translation unavailable`,
      );
      return sourceValue;
    }
    const translatedText = JSON.stringify(translated);

    await this.upsertTranslation({
      projectId,
      fieldKey,
      targetLocale,
      sourceLocale,
      sourceHash,
      translatedText,
    });

    return translated;
  }

  private async upsertTranslation(input: {
    projectId: string;
    fieldKey: string;
    targetLocale: SupportedLocale;
    sourceLocale: SupportedLocale;
    sourceHash: string;
    translatedText: string;
  }): Promise<void> {
    try {
      await this.prisma.contentTranslation.upsert({
        where: {
          projectId_fieldKey_targetLocale: {
            projectId: input.projectId,
            fieldKey: input.fieldKey,
            targetLocale: input.targetLocale,
          },
        },
        create: {
          projectId: input.projectId,
          fieldKey: input.fieldKey,
          targetLocale: input.targetLocale,
          sourceLocale: input.sourceLocale,
          sourceHash: input.sourceHash,
          translatedText: input.translatedText,
          provider: this.openAi.isConfigured() ? 'openai' : 'fallback',
        },
        update: {
          sourceLocale: input.sourceLocale,
          sourceHash: input.sourceHash,
          translatedText: input.translatedText,
          provider: this.openAi.isConfigured() ? 'openai' : 'fallback',
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to cache translation ${input.fieldKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
