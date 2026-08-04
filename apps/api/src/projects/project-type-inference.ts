import { ProjectType } from '@prisma/client';

/**
 * Construction Project/Work types selectable in UI and by AI.
 * Legacy enum values (extension, commercial_fitout) remain in DB but must not be chosen.
 */
export const SELECTABLE_CONSTRUCTION_PROJECT_TYPES = [
  ProjectType.new_build,
  ProjectType.modernization_reconstruction,
  ProjectType.renovation,
  ProjectType.repair,
  ProjectType.other,
] as const;

export type SelectableConstructionProjectType =
  (typeof SELECTABLE_CONSTRUCTION_PROJECT_TYPES)[number];

const SELECTABLE_SET = new Set<string>(SELECTABLE_CONSTRUCTION_PROJECT_TYPES);

/** Map legacy / out-of-list types onto the closed construction list. */
export function normalizeConstructionProjectType(
  type: string | null | undefined,
): ProjectType {
  if (!type) {
    return ProjectType.other;
  }
  if (type === ProjectType.design) {
    return ProjectType.design;
  }
  if (SELECTABLE_SET.has(type)) {
    return type as ProjectType;
  }
  if (type === ProjectType.extension) {
    return ProjectType.new_build;
  }
  if (type === ProjectType.commercial_fitout) {
    return ProjectType.renovation;
  }
  return ProjectType.other;
}

/**
 * Pick the single best Project/Work type from free-text description.
 * Always returns one of SELECTABLE_CONSTRUCTION_PROJECT_TYPES (never design).
 */
export function suggestProjectTypeFromText(text: string): ProjectType {
  const raw = text.trim();
  if (!raw) {
    return ProjectType.other;
  }

  const scores: Record<SelectableConstructionProjectType, number> = {
    [ProjectType.new_build]: 0,
    [ProjectType.modernization_reconstruction]: 0,
    [ProjectType.renovation]: 0,
    [ProjectType.repair]: 0,
    [ProjectType.other]: 0,
  };

  const rules: Array<{
    type: SelectableConstructionProjectType;
    pattern: RegExp;
    weight: number;
  }> = [
    {
      type: ProjectType.new_build,
      pattern:
        /\b(new\s*build|new\s*construction|build(ing)?\s+(a\s+)?(new\s+)?(house|villa|home|building)|greenfield|строительств\w*\s*(дом|вилл|здан|с\s*нул)|новострой|возведен\w*\s*(дом|здан)|строи\w*\s*под\s*ключ)\b/i,
      weight: 4,
    },
    {
      type: ProjectType.modernization_reconstruction,
      pattern:
        /\b(moderni[sz]ation|reconstruct|redevelop|капитальн\w*\s*ремонт|реконструкц|модернизац|перестройк\w*\s*здан)\b/i,
      weight: 4,
    },
    {
      type: ProjectType.renovation,
      pattern:
        /\b(renovat|remodel|refurbish|fit[\s-]?out|makeover|ремонт\w*\s*(квартир|дом|вилл|офис|помещен)|евроремонт|перепланировк|отделк\w*\s*(квартир|офис|помещен))\b/i,
      weight: 3,
    },
    {
      type: ProjectType.repair,
      pattern:
        /\b(repair|fix(ing)?|patch(ing)?|устранен\w*\s*неисправ|починк|аварийн\w*\s*ремонт|локальн\w*\s*ремонт|замен\w*\s*(труб|кровл|окон))\b/i,
      weight: 3,
    },
    {
      type: ProjectType.new_build,
      pattern: /\b(foundation|pile|piling|котлован|свай|фундамент)\b/i,
      weight: 1,
    },
    {
      type: ProjectType.renovation,
      pattern: /\b(kitchen|bathroom|interior|кухн|ванн|интерьер)\b/i,
      weight: 1,
    },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(raw)) {
      scores[rule.type] += rule.weight;
    }
  }

  let best: ProjectType = ProjectType.other;
  let bestScore = 0;
  for (const type of SELECTABLE_CONSTRUCTION_PROJECT_TYPES) {
    const score = scores[type];
    if (score > bestScore) {
      bestScore = score;
      best = type;
    }
  }

  return bestScore > 0 ? best : ProjectType.other;
}

export const PROJECT_TYPE_SELECTION_RULES = `Project/Work type selection (mandatory):
- projectType MUST be exactly one of: new_build, modernization_reconstruction, renovation, repair, other (or design only when the project track is design).
- Never use extension, commercial_fitout, or any free-text work-type label.
- Choose the single closest match from the client's description:
  - new_build: new construction / building from scratch
  - modernization_reconstruction: modernization, reconstruction, major redevelopment of an existing building
  - renovation: renovation, remodel, interior fit-out, apartment/house redo
  - repair: localized repair / fix of defects (not a full remodel)
  - other: only when none of the above fit
- Prefer the most specific match; do not invent types outside this list.`;
