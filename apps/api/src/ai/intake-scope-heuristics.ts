import { ProjectIntakeContext } from './intake.types';

const POOL_PATTERN =
  /\b(pool|swimming\s*pool|бассейн|สระว่ายน้ำ|สระน้ำ)\b/i;

const BUILDING_PRIMARY_PATTERN =
  /\b(house|villa|home|apartment|condo|дом|вилл|квартир|cottage|mansion|bungalow)\b/i;

/** Outdoor civil / landscaping amenity work (path, paving, fence, yard), not a building shell. */
const LANDSCAPING_OR_CIVIL_AMENITY_PATTERN =
  /\b(path|walkway|pav(e|ing|ed)|driveway|sidewalk|footpath|patio|decking|fence|fencing|gate|landscap|garden\s*(path|bed|work|works)?|yard\s*(path|work|works)|stone\s*(tile\s*)?path|tile\s*path|бордюр|дорожк|мощен|отмостк|забор|огражден|ландшафт|садов.*(дорож|работ)|мощен\w*|плитк\w*\s*дорож|ทางเดิน|ปูพื้น|รั้ว|ทางเท้า)\b/i;

/** Explicit building construction / renovation intent (not merely mentioning a nearby house). */
const BUILDING_CONSTRUCTION_INTENT_PATTERN =
  /\b((build|construct|erect|строительств|постройк).{0,48}(house|villa|home|apartment|building|дом|вилл|здан)|new\s*(house|villa|home|building)|house\s*(construction|build|extension)|villa\s*(construction|build|extension)|building\s*(construction|extension)|extension|пристройк|commercial\s*fit[- ]?out|fit[- ]?out|renovat\w*.{0,40}(kitchen|bathroom|interior|house|villa|apartment)|модернизац|реконструкц.{0,24}(здан|дом|вилл)|каркас\s*дом|этажност|storey\s*count|foundation\s*(type|work)|фундамент)\b/i;

const STOREY_FACT_PATTERN =
  /\b(storey|storeys|floor|floors|этаж|ชั้น)\b/i;

const POOL_DEPTH_FACT_PATTERN =
  /\b(depth|глубин|ลึก|\d+\s*(m|м|meters?|метров?)\b.*\b(deep|глубин)|pool\s*depth|глубина\s*бассейн)/i;

const PUMP_STATION_FACT_PATTERN =
  /\b(pump\s*(room|house|station)|equipment\s*room|насосн|машинн.*(отделен|комнат)|ปั๊ม|ห้องเครื่อง)\b/i;

const UTILITY_CONNECTION_FACT_PATTERN =
  /\b(utility\s*connection|grid\s*connection|mains\s*(water|sewer|power)|подключен.*(сет|электр|вод|канал)|внешн.*(сет|ввод)|เชื่อมต่อ.*(ไฟ|น้ำ|ท่อ))\b/i;

const ELECTRICAL_SCOPE_FACT_PATTERN =
  /\b(lighting\s*fixtures|switchboard|distribution\s*board|щит|светильник|розетк|underwater\s*light|подводн.*свет)\b/i;

const PATH_LIGHTING_PATTERN =
  /\b(path\s*light|garden\s*light|outdoor\s*light|landscape\s*light|lighting|светильник|освещен|ไฟ\s*ทางเดิน|ไฟสวน)\b/i;

const WATER_TREATMENT_FACT_PATTERN =
  /\b(chlorine[- ]?free|без\s*хлор|salt\s*water|солев|uv\s*treat|озон|ozone|ultraviolet|ультрафиолет|salt\s*chlorin)\b/i;

const FOUNDATION_FACT_PATTERN =
  /\b(foundation|footing|pile|piles|raft|slab\s*foundation|фундамент|свай|ростверк|ฐานราก|เสาเข็ม)\b/i;

export const POOL_INTAKE_QUESTION_IDS = [
  'pool-depth',
  'pool-pump-station',
  'pool-water-treatment',
  'pool-lighting',
] as const;

/** Building-shell FAQs that must not appear on landscaping / civil amenity-only jobs. */
export const BUILDING_SHELL_INTAKE_QUESTION_IDS = [
  'storey-count',
  'sanitary-points',
  'foundation-type',
  'special-systems',
] as const;

function documentNarrative(context: ProjectIntakeContext): string {
  return (
    context.documents
      ?.map((doc) =>
        [
          doc.summary,
          ...(doc.keyFacts ?? []),
          ...(doc.scopeLines ?? []).map(
            (line) => `${line.trade} ${line.description}`,
          ),
        ].join(' '),
      )
      .join(' ') ?? ''
  );
}

/** Title, client description, and uploaded plan/document text — not AI rewrites or prior answers. */
export function projectSourceNarrative(context: ProjectIntakeContext): string {
  return [context.title, context.description ?? '', documentNarrative(context)]
    .join(' ')
    .trim();
}

export function intakeNarrative(context: ProjectIntakeContext): string {
  const answersText = context.answers
    .map((a) => {
      if (a.skipped) return '';
      const base = Array.isArray(a.value) ? a.value.join(' ') : String(a.value ?? '');
      return `${base} ${a.customText ?? ''}`;
    })
    .join(' ');

  return [
    projectSourceNarrative(context),
    context.improvedDescription ?? '',
    answersText,
  ]
    .join(' ')
    .trim();
}

/**
 * True when source text is about outdoor civil/landscaping amenity work and does not
 * clearly describe building shell construction (house/villa build, fit-out, etc.).
 */
export function isLandscapingOrCivilAmenityNarrative(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  if (!LANDSCAPING_OR_CIVIL_AMENITY_PATTERN.test(trimmed)) {
    return false;
  }
  if (BUILDING_CONSTRUCTION_INTENT_PATTERN.test(trimmed)) {
    return false;
  }
  return true;
}

export function isLandscapingOrCivilAmenityOnly(
  context: ProjectIntakeContext,
): boolean {
  return isLandscapingOrCivilAmenityNarrative(projectSourceNarrative(context));
}

/**
 * Single-element work: repairing or replacing one building element — roof,
 * windows, tiles, paint, flooring — rather than a room, a floor or a building.
 *
 * Nothing about the building's systems is being decided in these jobs, so
 * utility connections, electrical depth, sanitary points and special systems are
 * noise. Keyed on the scope wording rather than the trade name, so a new element
 * type is covered without adding a rule.
 *
 * Cyrillic alternatives are bounded by explicit non-letter groups instead of
 * `\b`, which only recognises ASCII word characters. Bare `пол` is deliberately
 * absent: it is a substring of `полная замена` and would misfire.
 */
const SINGLE_ELEMENT_WORK_PATTERN =
  /(\b(roof|roofing|gutter|downpipe|window|windows|glazing|door|doors|tile|tiles|tiling|floor|flooring|parquet|laminate|paint|painting|repaint|facade|plaster|render|waterproofing|insulation|ceiling|cladding)\b)|(?:^|[^а-яё])(кровл|крыш|окн|двер|плитк|покрас|фасад|штукатур|потолк|ламинат|паркет|утепл|гидроизоляц)(?:[^а-яё]|$)|(หลังคา|หน้าต่าง|ประตู|กระเบื้อง|พื้น|ทาสี|ฝ้า|ฉนวน)/i;

/** The whole building is in scope, so element-level reasoning does not apply. */
const WHOLE_BUILDING_PATTERN =
  /(\b(whole|entire)\s+(house|home|building|property)\b)|(\ball\s+rooms\b)|(весь\s+(дом|коттедж))|(вся\s+квартира)|(ทั้งหลัง|ทั้งบ้าน|ทุกห้อง)/i;

export function isSingleElementScope(
  context: ProjectIntakeContext,
): boolean {
  if (isBuildingShellPrimary(context)) {
    return false;
  }

  const narrative = projectSourceNarrative(context);
  if (!SINGLE_ELEMENT_WORK_PATTERN.test(narrative)) {
    return false;
  }
  if (BUILDING_CONSTRUCTION_INTENT_PATTERN.test(narrative)) {
    return false;
  }
  return !WHOLE_BUILDING_PATTERN.test(narrative);
}

/** True when the user explicitly confirmed a pool via special-systems. */
export function userSelectedPoolInAnswers(
  context: ProjectIntakeContext,
): boolean {
  return context.answers.some((a) => {
    if (a.questionId !== 'special-systems' || a.skipped) {
      return false;
    }
    const values = Array.isArray(a.value) ? a.value : [a.value];
    return values.includes('pool');
  });
}

/** Pool is in scope only when mentioned in title/description/plan or explicitly selected. */
export function projectMentionsPool(context: ProjectIntakeContext): boolean {
  if (POOL_PATTERN.test(projectSourceNarrative(context))) {
    return true;
  }
  return userSelectedPoolInAnswers(context);
}

export function isPoolFocusedProject(context: ProjectIntakeContext): boolean {
  return projectMentionsPool(context);
}

/** True when the main job is constructing/renovating a building shell, not an amenity-only scope. */
export function isBuildingShellPrimary(context: ProjectIntakeContext): boolean {
  if (isLandscapingOrCivilAmenityOnly(context)) {
    return false;
  }

  const narrative = intakeNarrative(context);
  if (!isPoolFocusedProject(context)) {
    return ['new_build', 'extension', 'commercial_fitout'].includes(
      context.projectType,
    );
  }

  const mentionsBuilding = BUILDING_PRIMARY_PATTERN.test(narrative);
  const poolIsHeadlined = POOL_PATTERN.test(projectSourceNarrative(context));

  if (
    poolIsHeadlined &&
    !/\b(new\s*build|строительств.*(дом|вилл|house)|extension|пристройк)/i.test(
      narrative,
    )
  ) {
    return false;
  }

  return mentionsBuilding && !poolIsHeadlined;
}

export function narrativeHasStoreyFact(context: ProjectIntakeContext): boolean {
  return STOREY_FACT_PATTERN.test(intakeNarrative(context));
}

export function narrativeHasPoolDepthFact(
  context: ProjectIntakeContext,
): boolean {
  return POOL_DEPTH_FACT_PATTERN.test(intakeNarrative(context));
}

export function narrativeHasPumpStationFact(
  context: ProjectIntakeContext,
): boolean {
  return PUMP_STATION_FACT_PATTERN.test(intakeNarrative(context));
}

export function narrativeHasUtilityConnectionFact(
  context: ProjectIntakeContext,
): boolean {
  if (UTILITY_CONNECTION_FACT_PATTERN.test(intakeNarrative(context))) {
    return true;
  }
  return context.answers.some(
    (a) => a.questionId === 'utility-connections' && !a.skipped,
  );
}

export function narrativeHasElectricalScopeFact(
  context: ProjectIntakeContext,
): boolean {
  if (ELECTRICAL_SCOPE_FACT_PATTERN.test(intakeNarrative(context))) {
    return true;
  }
  return context.answers.some(
    (a) => a.questionId === 'electrical-scope' && !a.skipped,
  );
}

export function narrativeHasWaterTreatmentFact(
  context: ProjectIntakeContext,
): boolean {
  if (WATER_TREATMENT_FACT_PATTERN.test(intakeNarrative(context))) {
    return true;
  }
  return context.answers.some(
    (a) => a.questionId === 'pool-water-treatment' && !a.skipped,
  );
}

export function shouldAskStoreyCount(context: ProjectIntakeContext): boolean {
  if (!isBuildingShellPrimary(context)) {
    return false;
  }
  return !narrativeHasStoreyFact(context);
}

export function narrativeHasFoundationFact(
  context: ProjectIntakeContext,
): boolean {
  if (FOUNDATION_FACT_PATTERN.test(intakeNarrative(context))) {
    return true;
  }
  return context.answers.some(
    (a) => a.questionId === 'foundation-type' && !a.skipped,
  );
}

export function shouldAskFoundationType(
  context: ProjectIntakeContext,
): boolean {
  if (!['new_build', 'extension'].includes(context.projectType)) {
    return false;
  }
  if (!isBuildingShellPrimary(context)) {
    return false;
  }
  return !narrativeHasFoundationFact(context);
}

export function shouldAskPoolScopeQuestions(
  context: ProjectIntakeContext,
): boolean {
  return projectMentionsPool(context);
}

export function shouldAskSpecialSystemsQuestion(
  context: ProjectIntakeContext,
): boolean {
  if (projectMentionsPool(context)) {
    return false;
  }
  if (isLandscapingOrCivilAmenityOnly(context)) {
    return false;
  }
  if (isSingleElementScope(context)) {
    return false;
  }
  if (
    !['new_build', 'extension', 'commercial_fitout'].includes(
      context.projectType,
    )
  ) {
    return false;
  }
  if (documentMentionsSpecialSystems(context)) {
    return false;
  }
  return isBuildingShellPrimary(context);
}

function documentMentionsSpecialSystems(
  context: ProjectIntakeContext,
): boolean {
  const pattern =
    /\b(elevator|lift|pool|basement|подвал|лифт|бассейн|smart\s*home|умн.*дом)\b/i;
  return Boolean(
    context.documents?.some(
      (doc) =>
        pattern.test(doc.summary) ||
        doc.keyFacts?.some((fact) => pattern.test(fact)),
    ),
  );
}

export function shouldAskUtilityConnectionQuestions(
  context: ProjectIntakeContext,
): boolean {
  if (narrativeHasUtilityConnectionFact(context)) {
    return false;
  }
  if (isLandscapingOrCivilAmenityOnly(context)) {
    return false;
  }
  // Replacing a roof, windows or tiles does not decide how the building is
  // supplied, even though the project type is `repair`.
  if (isSingleElementScope(context)) {
    return false;
  }
  return (
    isBuildingShellPrimary(context) ||
    isPoolFocusedProject(context) ||
    [
      'renovation',
      'repair',
      'modernization_reconstruction',
      'extension',
      'new_build',
      'commercial_fitout',
    ].includes(context.projectType)
  );
}

export function shouldAskElectricalScopeQuestions(
  context: ProjectIntakeContext,
): boolean {
  if (narrativeHasElectricalScopeFact(context)) {
    return false;
  }
  if (isLandscapingOrCivilAmenityOnly(context)) {
    return PATH_LIGHTING_PATTERN.test(projectSourceNarrative(context));
  }
  if (isSingleElementScope(context)) {
    return false;
  }
  return (
    isBuildingShellPrimary(context) ||
    isPoolFocusedProject(context) ||
    [
      'renovation',
      'repair',
      'modernization_reconstruction',
      'extension',
      'new_build',
    ].includes(context.projectType)
  );
}

export function shouldAskPoolWaterTreatmentQuestions(
  context: ProjectIntakeContext,
): boolean {
  return (
    isPoolFocusedProject(context) && !narrativeHasWaterTreatmentFact(context)
  );
}

export function shouldAskPoolLightingQuestions(
  context: ProjectIntakeContext,
): boolean {
  if (!isPoolFocusedProject(context)) {
    return false;
  }
  if (
    context.answers.some((a) => a.questionId === 'pool-lighting' && !a.skipped)
  ) {
    return false;
  }
  return !/\b(underwater\s*light|pool\s*light|подводн.*свет|светильник.*(бассейн|pool))\b/i.test(
    intakeNarrative(context),
  );
}

/**
 * Rooms and trades whose wet points the estimate needs to know about.
 *
 * The non-Latin alternatives are matched without `\b`: the boundary assertion
 * only recognises ASCII word characters, so it never fires next to Cyrillic or
 * Thai text.
 */
const WET_ROOM_PATTERN =
  /(\b(bathroom|bath\s*room|washroom|powder\s*room|kitchen|plumbing|pipework|sanitary|wet\s*(points?|areas?))\b)|(санузел|ванн|сантехник|кухн|трубопровод|สุขภัณฑ์|ห้องน้ำ|ห้องครัว|ประปา|ท่อน้ำ)/i;

/**
 * Individual fixtures. Repairing one of them decides nothing about the
 * building's systems, so a bare mention must not pull the question in.
 */
const WET_FIXTURE_PATTERN =
  /(\b(toilet|wc|sink|basin|tap|faucet|bathtub|vanity|water\s*heater|boiler)\b)|(унитаз|раковин|смесител|бойлер|อ่างล้างหน้า|โถส้วม)/i;

/** Room-level wet work: renovating/remodelling a bathroom or kitchen. */
const WET_ROOM_WORK_PATTERN =
  /((renovat|remodel|refit|refurbish|rebuild|upgrade|overhaul|renew)\w*\b[^.]{0,40}(bathroom|bath\s*room|kitchen|washroom))|((bathroom|bath\s*room|kitchen)\s*(renovation|remodel|refit|refurbishment|upgrade|works))|((new|second|extra|additional)\s+(bathroom|bath\s*room|kitchen))|(ремонт\w*\s*(ванн|санузл|кухн)|(ванн|санузл|кухн)\w*\s*под\s*ключ)|(ปรับปรุง\s*(ห้องน้ำ|ห้องครัว)|ต่อเติม\s*(ห้องน้ำ|ห้องครัว))/i;

/** The client already stated the count — asking again is noise. */
const WET_POINTS_STATED_COUNT_PATTERN =
  /\b(\d{1,3}\s*(points?|точек|сантех|toilets?|bathrooms?|sinks?|basins?|showers?|wc))\b/i;

/**
 * A question (or a model-authored paraphrase) that asks for wet-point counts.
 * Used to gate free-text questions that never went through the intake queue,
 * such as the estimate's improvement questions.
 */
export const WET_POINTS_QUESTION_PATTERN =
  /(\b(sanitary|wet\s*points?|wet\s*areas?|wet\s*rooms?)\b)|((how\s+many|number\s+of|count\s+of)\s+(bathrooms?|bath\s*rooms?|toilets?|wc|showers?|sinks?|washrooms?))|((bathrooms?|toilets?|showers?|sinks?)\s*(count|quantity))|(сантехник|санузел|санузел|สุขภัณฑ์|จุดเปียก|ห้องน้ำ|ห้องส้วม|อ่างล้างหน้า|กี่จุด)/i;

/**
 * Does the scope need a wet-point count at all?
 *
 * Sanitary wet points are irrelevant to a single repaired element — a roof, a
 * window, a painted wall, one leaking toilet — however the sentence happens to
 * mention a room. They are relevant when a bathroom or kitchen is being worked
 * on, when the whole dwelling is in scope, or when a new dwelling is built.
 *
 * Takes plain text rather than the intake context, so the estimate stage can
 * apply exactly the same rule to its own narrative and questions.
 */
export function wetPointsInScope(
  narrative: string,
  projectType?: string,
): boolean {
  const text = narrative.trim();
  if (!text) {
    return false;
  }

  if (WHOLE_BUILDING_PATTERN.test(text)) {
    return true;
  }
  if (WET_ROOM_WORK_PATTERN.test(text)) {
    return true;
  }
  if (isLandscapingOrCivilAmenityNarrative(text)) {
    return false;
  }

  const mentionsWet =
    WET_ROOM_PATTERN.test(text) || WET_FIXTURE_PATTERN.test(text);

  // A new dwelling always has wet points, even when the description only talks
  // about bedrooms and plot size.
  if (projectType === 'new_build' && BUILDING_PRIMARY_PATTERN.test(text)) {
    return true;
  }
  // Extensions and fit-outs are building works, but only wet work justifies the
  // question there.
  if (
    projectType === 'new_build' ||
    projectType === 'extension' ||
    projectType === 'commercial_fitout'
  ) {
    return mentionsWet;
  }

  // Small jobs: one element or one fixture means nothing about the systems is
  // being decided, however the sentence mentions a room.
  if (SINGLE_ELEMENT_WORK_PATTERN.test(text) || WET_FIXTURE_PATTERN.test(text)) {
    return false;
  }
  return mentionsWet;
}

export function shouldAskSanitaryPointsQuestions(
  context: ProjectIntakeContext,
): boolean {
  if (
    context.answers.some((a) => a.questionId === 'sanitary-points' && !a.skipped)
  ) {
    return false;
  }

  // The client's own words only: an AI-written improvedDescription used to be
  // able to invent a bathroom and pull the question in.
  const source = projectSourceNarrative(context);
  if (WET_POINTS_STATED_COUNT_PATTERN.test(source)) {
    return false;
  }

  return wetPointsInScope(source, context.projectType);
}
