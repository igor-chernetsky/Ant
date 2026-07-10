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

  async getOrTranslateText(input: {
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

    const translated =
      (await this.openAi.translateText(
        sourceText,
        sourceLocale,
        targetLocale,
      )) ?? sourceText;

    try {
      await this.prisma.contentTranslation.upsert({
        where: {
          projectId_fieldKey_targetLocale: {
            projectId,
            fieldKey,
            targetLocale,
          },
        },
        create: {
          projectId,
          fieldKey,
          targetLocale,
          sourceLocale,
          sourceHash,
          translatedText: translated,
          provider: this.openAi.isConfigured() ? 'openai' : 'fallback',
        },
        update: {
          sourceLocale,
          sourceHash,
          translatedText: translated,
          provider: this.openAi.isConfigured() ? 'openai' : 'fallback',
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to cache translation ${fieldKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return translated;
  }

  async getOrTranslateJson<T>(input: {
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
        // fall through to re-translate
      }
    }

    const translated =
      (await this.openAi.translateJson(
        sourceValue,
        sourceLocale,
        targetLocale,
      )) ?? sourceValue;
    const translatedText = JSON.stringify(translated);

    try {
      await this.prisma.contentTranslation.upsert({
        where: {
          projectId_fieldKey_targetLocale: {
            projectId,
            fieldKey,
            targetLocale,
          },
        },
        create: {
          projectId,
          fieldKey,
          targetLocale,
          sourceLocale,
          sourceHash,
          translatedText,
          provider: this.openAi.isConfigured() ? 'openai' : 'fallback',
        },
        update: {
          sourceLocale,
          sourceHash,
          translatedText,
          provider: this.openAi.isConfigured() ? 'openai' : 'fallback',
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to cache JSON translation ${fieldKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return translated;
  }
}
