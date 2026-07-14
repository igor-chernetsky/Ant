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

  return [
    context.title,
    context.description ?? '',
    context.improvedDescription ?? '',
    docText,
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

  // Pool projects can still involve a villa context — only ask storeys if shell work is primary.
  const mentionsBuilding = BUILDING_PRIMARY_PATTERN.test(narrative);
  const poolIsHeadlined =
    POOL_PATTERN.test(context.title) ||
    POOL_PATTERN.test(context.description ?? '') ||
    POOL_PATTERN.test(context.improvedDescription ?? '');

  if (poolIsHeadlined && !/\b(new\s*build|строительств.*(дом|вилл|house)|extension|пристройк)/i.test(narrative)) {
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
