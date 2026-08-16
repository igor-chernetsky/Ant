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
 * JS `\b` is ASCII-oriented; use Unicode letter/number edges for RU/TH text.
 * Keep `\b` only on English-only patterns.
 */
const EDGE_L = '(?:^|[^\\p{L}\\p{N}_])';
const EDGE_R = '(?:[^\\p{L}\\p{N}_]|$)';

/** Building / facility nouns that usually imply new construction when paired with "build/construct". */
const BUILDING_NOUN_EN =
  '(?:house|villa|home|homes|building|buildings|school|schools|warehouse|factory|plant|office|offices|hotel|resort|clinic|hospital|mall|apartment|apartments|condo|condominium|townhouse|duplex|bungalow|church|temple|mosque|stadium|gym|garage|shed|pavilion|tower|campus|facility|facilities)';

const BUILDING_NOUN_RU =
  '(?:дом(?:а|ов)?|вилл\\p{L}*|здан\\p{L}*|школ\\p{L}*|склад\\p{L}*|завод\\p{L}*|офис\\p{L}*|гостиниц\\p{L}*|больниц\\p{L}*|храм\\p{L}*|объект\\p{L}*)';

type InferenceRule = {
  type: SelectableConstructionProjectType;
  pattern: RegExp;
  weight: number;
};

const INFERENCE_RULES: InferenceRule[] = [
  // --- new_build (strong) ---
  {
    type: ProjectType.new_build,
    pattern:
      /\b(new\s*build|new[\s-]*construction|greenfield|turnkey|from\s+scratch|ground[\s-]*up)\b/i,
    weight: 5,
  },
  {
    type: ProjectType.new_build,
    pattern: new RegExp(
      `${EDGE_L}(строительств\\p{L}*\\s*(с\\s*нул\\p{L}*|под\\s*ключ)|новострой\\p{L}*|возведен\\p{L}*|строи\\p{L}*\\s*под\\s*ключ)${EDGE_R}`,
      'iu',
    ),
    weight: 5,
  },
  {
    type: ProjectType.new_build,
    pattern: /(ก่อสร้างใหม่|สร้างใหม่|งานก่อสร้างใหม่)/i,
    weight: 5,
  },
  // "construction of/on a school", "constructing a two-storey building"
  {
    type: ProjectType.new_build,
    pattern: new RegExp(
      String.raw`\b(construction|construct(?:ing|ion)?|build(?:ing)?|erect(?:ing|ion)?)\s+(?:of|on|for)?\s*(?:a|an|the|two[\s-]?storey|multi[\s-]?storey|\d+[\s-]?(?:storey|story|floor)s?)?\s*${BUILDING_NOUN_EN}\b`,
      'i',
    ),
    weight: 5,
  },
  // "school construction", "warehouse build"
  {
    type: ProjectType.new_build,
    pattern: new RegExp(
      String.raw`\b${BUILDING_NOUN_EN}\s+(?:new\s+)?(?:construction|build(?:ing)?|project)\b`,
      'i',
    ),
    weight: 4,
  },
  // "строительство школы / здания / дома"
  {
    type: ProjectType.new_build,
    pattern: new RegExp(
      `${EDGE_L}(строительств\\p{L}*|возведен\\p{L}*|постройк\\p{L}*)\\s+${BUILDING_NOUN_RU}${EDGE_R}`,
      'iu',
    ),
    weight: 5,
  },
  // Thai: ก่อสร้างโรงเรียน / สร้างอาคาร
  {
    type: ProjectType.new_build,
    pattern:
      /(ก่อสร้าง|สร้าง)\s*(อาคาร|บ้าน|โรงเรียน|โรงงาน|โกดัง|โรงแรม|คอนโด|ทาวน์โฮม|สถานศึกษา)/i,
    weight: 5,
  },
  // storey / structural cues typical of new builds
  {
    type: ProjectType.new_build,
    pattern:
      /\b(\d+[\s-]?(?:storey|story|floor)|two[\s-]?storey|multi[\s-]?storey|reinforced\s+concrete\s+(?:structure|frame))\b/i,
    weight: 2,
  },
  {
    type: ProjectType.new_build,
    pattern: new RegExp(
      `${EDGE_L}(каркас\\s+здан\\p{L}*|этажн\\p{L}*\\s*здан\\p{L}*)${EDGE_R}`,
      'iu',
    ),
    weight: 2,
  },
  {
    type: ProjectType.new_build,
    pattern: /\b(foundation|foundations|pile|piling|bored\s+pile)\b/i,
    weight: 2,
  },
  {
    type: ProjectType.new_build,
    pattern: new RegExp(
      `${EDGE_L}(котлован\\p{L}*|свай\\p{L}*|фундамент\\p{L}*)${EDGE_R}`,
      'iu',
    ),
    weight: 2,
  },
  {
    type: ProjectType.new_build,
    pattern: /(เสาเข็ม|ฐานราก)/i,
    weight: 2,
  },

  // --- modernization / reconstruction ---
  {
    type: ProjectType.modernization_reconstruction,
    pattern:
      /\b(moderni[sz]ation|reconstruct(?:ion|ing)?|redevelop(?:ment|ing)?|major\s+redevelopment)\b/i,
    weight: 5,
  },
  {
    type: ProjectType.modernization_reconstruction,
    pattern: new RegExp(
      `${EDGE_L}(капитальн\\p{L}*\\s*ремонт|реконструкц\\p{L}*|модернизац\\p{L}*|перестройк\\p{L}*\\s*здан\\p{L}*)${EDGE_R}`,
      'iu',
    ),
    weight: 5,
  },
  {
    type: ProjectType.modernization_reconstruction,
    pattern: /(ปรับปรุงใหญ่|ปรับปรุงโครงสร้าง|บูรณะอาคาร)/i,
    weight: 4,
  },

  // --- renovation ---
  {
    type: ProjectType.renovation,
    pattern:
      /\b(renovat(?:e|ion|ing)?|remodel(?:ing|ling)?|refurbish(?:ment|ing)?|fit[\s-]?out|makeover|interior\s+(?:fit[\s-]?out|redesign))\b/i,
    weight: 4,
  },
  {
    type: ProjectType.renovation,
    pattern: new RegExp(
      `${EDGE_L}(евроремонт|перепланировк\\p{L}*|отделк\\p{L}*\\s*(квартир\\p{L}*|дом\\p{L}*|вилл\\p{L}*|офис\\p{L}*|помещен\\p{L}*)|ремонт\\p{L}*\\s*(квартир\\p{L}*|дом\\p{L}*|вилл\\p{L}*|офис\\p{L}*|помещен\\p{L}*|интерьер\\p{L}*))${EDGE_R}`,
      'iu',
    ),
    weight: 4,
  },
  {
    type: ProjectType.renovation,
    pattern: /(รีโนเวท|ตกแต่งภายใน|ปรับปรุงภายใน|รีโมเดล)/i,
    weight: 4,
  },
  {
    type: ProjectType.renovation,
    pattern: /\b(kitchen|bathroom|interior)\b/i,
    weight: 1,
  },
  {
    type: ProjectType.renovation,
    pattern: new RegExp(
      `${EDGE_L}(кухн\\p{L}*|ванн\\p{L}*|санузел\\p{L}*|интерьер\\p{L}*)${EDGE_R}`,
      'iu',
    ),
    weight: 1,
  },
  {
    type: ProjectType.renovation,
    pattern: /(ห้องครัว|ห้องน้ำ)/i,
    weight: 1,
  },

  // --- repair (localized; keep below full remodel cues) ---
  {
    type: ProjectType.repair,
    pattern: /\b(repair(?:s|ing)?|fix(?:es|ing)?|patch(?:es|ing)?)\b/i,
    weight: 4,
  },
  {
    type: ProjectType.repair,
    pattern: new RegExp(
      `${EDGE_L}(устранен\\p{L}*\\s*неисправ\\p{L}*|починк\\p{L}*|аварийн\\p{L}*\\s*ремонт|локальн\\p{L}*\\s*ремонт|замен\\p{L}*\\s*(труб\\p{L}*|кровл\\p{L}*|окон\\p{L}*|дверь\\p{L}*|кондиционер\\p{L}*))${EDGE_R}`,
      'iu',
    ),
    weight: 4,
  },
  {
    type: ProjectType.repair,
    pattern: /(ซ่อมแซม|แก้ไขชำรุด|ซ่อมบำรุง)/i,
    weight: 4,
  },
];

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

  for (const rule of INFERENCE_RULES) {
    if (rule.pattern.test(raw)) {
      scores[rule.type] += rule.weight;
    }
  }

  // Prefer more specific non-other types on ties (new_build first in list).
  let best: ProjectType = ProjectType.other;
  let bestScore = 0;
  for (const type of SELECTABLE_CONSTRUCTION_PROJECT_TYPES) {
    if (type === ProjectType.other) {
      continue;
    }
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
  - new_build: new construction / building from scratch — including phrases like "construction of a school/building", "school construction", storey counts with a new building, foundations/piling for a new structure
  - modernization_reconstruction: modernization, reconstruction, major redevelopment of an existing building
  - renovation: renovation, remodel, interior fit-out, apartment/house redo
  - repair: localized repair / fix of defects (not a full remodel)
  - other: only when none of the above fit
- Prefer the most specific match; do not invent types outside this list.
- If the narrative clearly describes erecting a new building/facility, choose new_build even when the word "new" is missing.`;
