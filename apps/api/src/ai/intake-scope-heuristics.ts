import { ProjectIntakeContext } from './intake.types';

const POOL_PATTERN =
  /\b(pool|swimming\s*pool|бассейн|สระว่ายน้ำ|สระน้ำ)\b/i;

const BUILDING_PRIMARY_PATTERN =
  /\b(house|villa|home|apartment|condo|дом|вилл|квартир|cottage|mansion|bungalow)\b/i;

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

const WATER_TREATMENT_FACT_PATTERN =
  /\b(chlorine[- ]?free|без\s*хлор|salt\s*water|солев|uv\s*treat|озон|ozone|ultraviolet|ультрафиолет|salt\s*chlorin)\b/i;

export function intakeNarrative(context: ProjectIntakeContext): string {
  const docText =
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
      .join(' ') ?? '';

  const answersText = context.answers
    .map((a) => {
      if (a.skipped) return '';
      const base = Array.isArray(a.value) ? a.value.join(' ') : String(a.value ?? '');
      return `${base} ${a.customText ?? ''}`;
    })
    .join(' ');

  return [
    context.title,
    context.description ?? '',
    context.improvedDescription ?? '',
    docText,
    answersText,
  ]
    .join(' ')
    .trim();
}

export function isPoolFocusedProject(context: ProjectIntakeContext): boolean {
  return POOL_PATTERN.test(intakeNarrative(context));
}

/** True when the main job is constructing/renovating a building shell, not an amenity-only scope. */
export function isBuildingShellPrimary(context: ProjectIntakeContext): boolean {
  const narrative = intakeNarrative(context);
  if (!isPoolFocusedProject(context)) {
    return ['new_build', 'extension', 'commercial_fitout'].includes(
      context.projectType,
    );
  }

  const mentionsBuilding = BUILDING_PRIMARY_PATTERN.test(narrative);
  const poolIsHeadlined =
    POOL_PATTERN.test(context.title) ||
    POOL_PATTERN.test(context.description ?? '') ||
    POOL_PATTERN.test(context.improvedDescription ?? '');

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

export function shouldAskPoolScopeQuestions(
  context: ProjectIntakeContext,
): boolean {
  return isPoolFocusedProject(context);
}

export function shouldAskUtilityConnectionQuestions(
  context: ProjectIntakeContext,
): boolean {
  if (narrativeHasUtilityConnectionFact(context)) {
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

export function shouldAskSanitaryPointsQuestions(
  context: ProjectIntakeContext,
): boolean {
  if (!isBuildingShellPrimary(context)) {
    return false;
  }
  if (
    context.answers.some((a) => a.questionId === 'sanitary-points' && !a.skipped)
  ) {
    return false;
  }
  return !/\b(\d+\s*(points?|точек|сантех)|sanitary\s*points?)\b/i.test(
    intakeNarrative(context),
  );
}
