import { Injectable } from '@nestjs/common';
import { suggestTagSlugsFromText } from '../projects/project-brief';
import { ScopeSyncContext, ScopeSyncResult } from '../projects/scope-sync.types';

const CHAT_SCOPE_KEYWORDS = [
  'scope',
  'include',
  'included',
  'exclude',
  'excluded',
  'material',
  'materials',
  'timeline',
  'schedule',
  'deadline',
  'completion',
  'sqm',
  'square',
  'area',
  'floor',
  'room',
  'kitchen',
  'bathroom',
  'structural',
  'demolition',
  'permit',
  'design',
  'tile',
  'plumbing',
  'electrical',
  'paint',
  'roof',
  'wall',
  'ceiling',
  'furniture',
  'fixture',
  'boq',
  'works',
  'work',
  'renovation',
  'renovate',
  'build',
  'construction',
  'not included',
  'client supply',
  'supplied by',
];

@Injectable()
export class ScopeSyncFallbackService {
  processScopeUpdate(context: ScopeSyncContext): ScopeSyncResult {
    if (
      context.update.source === 'client_chat' &&
      !this.isClientChatScopeRelevant(context.update.body)
    ) {
      return {
        applied: false,
        updatedDescription: context.description?.trim() || context.title,
        updatedSummary:
          context.brief.summary?.trim() ||
          context.description?.trim() ||
          context.title,
        updatedScopeSummary:
          context.scopeSummary?.trim() ||
          context.description?.trim() ||
          context.title,
        tagSlugs: [],
        confidence: 0,
        provider: 'fallback',
      };
    }

    const baseDescription =
      context.description?.trim() ||
      context.brief.summary?.trim() ||
      context.title;
    const updatedDescription =
      `${baseDescription}\n\nClarification update:\n${context.update.body}`.trim();
    const updatedSummary =
      context.brief.summary?.trim() ||
      updatedDescription.slice(0, 400);
    const updatedScopeSummary =
      context.scopeSummary?.trim() ||
      updatedSummary ||
      updatedDescription.slice(0, 300);

    const narrative = [
      context.title,
      updatedDescription,
      context.update.body,
    ].join(' ');
    const allowed = new Set(context.availableTagSlugs);
    const tagSlugs = suggestTagSlugsFromText(narrative).filter((slug) =>
      allowed.has(slug),
    );

    const constraints = mergeConstraints(
      context.brief.constraints,
      context.update.body,
    );

    return {
      applied: true,
      updatedDescription,
      updatedSummary,
      updatedScopeSummary,
      tagSlugs,
      confidence: 0.35,
      provider: 'fallback',
      briefPatches: constraints ? { constraints } : undefined,
    };
  }

  isClientChatScopeRelevant(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    if (normalized.length < 12) {
      return false;
    }
    return CHAT_SCOPE_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }
}

function mergeConstraints(
  existing: string | undefined,
  updateText: string,
): string | undefined {
  const parts = [existing?.trim(), updateText.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}
