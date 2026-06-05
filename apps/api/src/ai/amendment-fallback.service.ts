import { Injectable } from '@nestjs/common';
import { suggestTagSlugsFromText } from '../projects/project-brief';
import { AmendmentAiResult, AmendmentContext } from './amendment.types';

@Injectable()
export class AmendmentFallbackService {
  processAmendments(context: AmendmentContext): AmendmentAiResult {
    const amendmentText = context.amendments
      .map((a) => {
        const type = a.changeType ? `[${a.changeType}] ` : '';
        return `${type}${a.body}`;
      })
      .join('\n');

    const baseDescription =
      context.description?.trim() ||
      context.brief.summary?.trim() ||
      context.title;

    const updatedDescription = `${baseDescription}\n\nClient updates:\n${amendmentText}`.trim();
    const updatedSummary =
      context.brief.summary?.trim() ||
      updatedDescription.slice(0, 400);

    const narrative = [
      context.title,
      updatedDescription,
      amendmentText,
    ].join(' ');

    const allowed = new Set(context.availableTagSlugs);
    const tagSlugs = suggestTagSlugsFromText(narrative).filter((slug) =>
      allowed.has(slug),
    );

    const constraints = mergeConstraints(
      context.brief.constraints,
      amendmentText,
    );

    return {
      updatedDescription,
      updatedSummary,
      tagSlugs,
      confidence: 0.35,
      provider: 'fallback',
      briefPatches: constraints ? { constraints } : undefined,
    };
  }
}

function mergeConstraints(
  existing: string | undefined,
  amendmentText: string,
): string | undefined {
  const parts = [existing?.trim(), amendmentText.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}
