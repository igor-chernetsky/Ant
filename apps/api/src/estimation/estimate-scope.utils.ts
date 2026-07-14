import { ProjectBriefV1 } from '../projects/project-brief';
import { EstimateLine } from './estimates.types';
import { TH_REGIONAL_CATALOG } from './regional-catalog';

export const ALLOWED_ESTIMATE_TRADES = new Set(
  TH_REGIONAL_CATALOG.map((item) => item.trade),
);

const ELEVATOR_PATTERN =
  /\b(elevator|elevators|lift|lifts|лифт|лифты|passenger\s+lift)\b/i;

/** Core trades that should not vanish after an additive scope change. */
const CORE_SCOPE_TRADES = new Set([
  'structural',
  'finishing',
  'electrical',
  'plumbing',
  'roofing',
  'demolition',
  'hvac',
  'windows-doors',
  'tiling',
  'flooring',
  'painting',
]);

export function catalogTradeSlugs(): string[] {
  return TH_REGIONAL_CATALOG.map((item) => item.trade);
}

export function formatIntakeAnswersForEstimate(
  brief: ProjectBriefV1,
): Array<{ questionId: string; answer: string }> {
  const answers = brief.ai?.intake?.answers ?? [];
  return answers
    .filter((entry) => !entry.skipped)
    .map((entry) => {
      const base = Array.isArray(entry.value)
        ? entry.value.join(', ')
        : String(entry.value ?? '');
      const answer = entry.customText
        ? `${base}${base ? ': ' : ''}${entry.customText}`
        : base;
      return { questionId: entry.questionId, answer: answer.trim() };
    })
    .filter((entry) => entry.answer.length > 0);
}

export function intakeConfirmsSpecialSystem(
  brief: ProjectBriefV1,
  description: string | null,
  pattern: RegExp,
): boolean {
  const text = [
    description ?? '',
    brief.summary ?? '',
    ...formatIntakeAnswersForEstimate(brief).map((row) => row.answer),
  ].join(' ');

  if (pattern.test(text)) {
    return true;
  }

  const specialAnswer = brief.ai?.intake?.answers?.find(
    (entry) => entry.questionId === 'special-systems' && !entry.skipped,
  );
  if (!specialAnswer) {
    return false;
  }

  const values = Array.isArray(specialAnswer.value)
    ? specialAnswer.value
    : [String(specialAnswer.value ?? '')];

  if (values.includes('none')) {
    return false;
  }

  if (pattern === ELEVATOR_PATTERN && values.includes('elevator')) {
    return true;
  }

  const combined = [...values, specialAnswer.customText ?? ''].join(' ');

  return pattern.test(combined);
}

export function buildEstimateScopeRules(
  projectType: string,
  propertyType: string | null,
  hasPreviousEstimate: boolean,
): string {
  const allowed = catalogTradeSlugs().join(', ');
  const lines = [
    `trade on each line MUST be one of: ${allowed}. Do not invent new trade slugs.`,
    'Only include scope that is explicitly stated or clearly implied by project data and intake answers.',
    'If a major system (elevator, pool, basement, facade access equipment) is uncertain, omit it from lines — it should be clarified in intake instead.',
    'Price lighting fixtures and water-supply utility connection realistically for Thailand — do not underprice them relative to catalog guidance.',
    'Cover confirmed MEP (electrical, plumbing) whenever wiring, lighting, fixtures, water supply, or sanitary works are in scope.',
  ];

  if (hasPreviousEstimate) {
    lines.push(
      'A previousEstimate is provided. REVISE it for the updated scope: keep still-relevant trades, adjust quantities/prices as needed, and ADD lines for new work. Do NOT drop construction, finishing, or electrical lines just because newer items (tiling, furniture, umbrellas) were added.',
      'Only remove a previous trade if the updated scope clearly cancels that work.',
    );
  }

  if (
    propertyType === 'house' ||
    (propertyType === 'apartment' && projectType !== 'commercial_fitout')
  ) {
    lines.push(
      'For house or apartment projects: do NOT include elevators, lifts, podium works, or commercial-scale building services unless intake answers or description explicitly require them.',
    );
  }

  if (projectType === 'new_build' && propertyType === 'house') {
    lines.push(
      'Typical single-family new build: structural, roofing, MEP (electrical, plumbing, hvac), windows-doors, finishing — not passenger elevators unless confirmed.',
    );
  }

  return lines.map((line) => `- ${line}`).join('\n');
}

const TRADE_KEYWORD_MAP: Array<{ pattern: RegExp; trade: string }> = [
  { pattern: ELEVATOR_PATTERN, trade: 'structural' },
  { pattern: /\b(pool|swimming|бассейн)\b/i, trade: 'structural' },
  {
    pattern:
      /\b(foundation|footing|pile|structural|civil|строительн|конструкц|каркас|бетон|фундамент)\b/i,
    trade: 'structural',
  },
  { pattern: /\b(roof|roofing|кровл|крыш)\b/i, trade: 'roofing' },
  {
    pattern:
      /\b(electric|wiring|lighting|свет|освещ|электро|электрик|проводк)\b/i,
    trade: 'electrical',
  },
  {
    pattern:
      /\b(plumb|sanitary|pipe|water\s*supply|водоснаб|водопровод|сантех|канализ)\b/i,
    trade: 'plumbing',
  },
  { pattern: /\b(hvac|air\s*con|a\/c|кондиц|ventil|вентиляц)\b/i, trade: 'hvac' },
  { pattern: /\b(paint|покраск|маляр)\b/i, trade: 'painting' },
  { pattern: /\b(tile|tiling|плитк|кафель)\b/i, trade: 'tiling' },
  { pattern: /\b(floor|напольн|покрыт.*пол)\b/i, trade: 'flooring' },
  {
    pattern: /\b(window|door|окон|двер)\b/i,
    trade: 'windows-doors',
  },
  { pattern: /\b(design|architect|проектн|дизайн)\b/i, trade: 'design' },
  {
    pattern: /\b(demolition|strip|демонтаж|разборк)\b/i,
    trade: 'demolition',
  },
  {
    pattern:
      /\b(finish|fitout|fit-out|отделк|чистовая|черновая|отделочн)\b/i,
    trade: 'finishing',
  },
  {
    pattern: /\b(landscape|umbrella|зонтик|зонт|благоустрой)\b/i,
    trade: 'landscaping',
  },
  { pattern: /\b(carpent|joinery|столяр|мебел)\b/i, trade: 'carpentry' },
  { pattern: /\b(insulat|утеплен|теплоизоляц)\b/i, trade: 'insulation' },
];

export function mapLineToCatalogTrade(line: EstimateLine): EstimateLine | null {
  const trade = line.trade.trim().toLowerCase().replace(/\s+/g, '-');
  if (ALLOWED_ESTIMATE_TRADES.has(trade)) {
    return { ...line, trade };
  }

  const description = `${line.trade} ${line.description}`;

  for (const mapping of TRADE_KEYWORD_MAP) {
    if (mapping.pattern.test(description)) {
      const catalog = TH_REGIONAL_CATALOG.find(
        (item) => item.trade === mapping.trade,
      );
      if (!catalog) continue;
      return {
        ...line,
        trade: mapping.trade,
        description: line.description || catalog.label,
      };
    }
  }

  // Soft fallback: keep priced lines under finishing rather than dropping them.
  if (line.lineMin > 0 || line.lineMax > 0) {
    return {
      ...line,
      trade: 'finishing',
      description: line.description || line.trade,
    };
  }

  return null;
}

function isElevatorLine(line: EstimateLine): boolean {
  return ELEVATOR_PATTERN.test(`${line.trade} ${line.description}`);
}

export function filterEstimateLines(input: {
  lines: EstimateLine[];
  projectType: string;
  propertyType: string | null;
  description: string | null;
  brief: ProjectBriefV1;
}): EstimateLine[] {
  const filtered: EstimateLine[] = [];
  const seenTrades = new Set<string>();

  for (const rawLine of input.lines) {
    const line = mapLineToCatalogTrade(rawLine);
    if (!line) {
      continue;
    }

    if (
      isElevatorLine(line) &&
      !intakeConfirmsSpecialSystem(input.brief, input.description, ELEVATOR_PATTERN)
    ) {
      continue;
    }

    if (
      (input.propertyType === 'house' || input.propertyType === 'apartment') &&
      isElevatorLine(line) &&
      input.projectType !== 'commercial_fitout'
    ) {
      continue;
    }

    filtered.push(line);
    seenTrades.add(line.trade);
  }

  return filtered;
}

/**
 * When regenerating after additive scope changes, keep earlier core trades
 * that the model dropped even though the scope did not cancel them.
 */
export function mergePreviousEstimateLines(input: {
  nextLines: EstimateLine[];
  previousLines: EstimateLine[];
  description: string | null;
  brief: ProjectBriefV1;
  tagSlugs: string[];
}): EstimateLine[] {
  if (input.previousLines.length === 0) {
    return input.nextLines;
  }

  const merged = [...input.nextLines];
  const presentTrades = new Set(merged.map((line) => line.trade));
  const narrative = [
    input.description ?? '',
    input.brief.summary ?? '',
    ...(input.brief.packages ?? []).map((pkg) => pkg.description ?? ''),
    ...input.tagSlugs,
  ]
    .join(' ')
    .toLowerCase();

  for (const previous of input.previousLines) {
    const mapped = mapLineToCatalogTrade(previous);
    if (!mapped || presentTrades.has(mapped.trade)) {
      continue;
    }

    const stillRelevant =
      CORE_SCOPE_TRADES.has(mapped.trade) ||
      input.tagSlugs.includes(mapped.trade) ||
      narrative.includes(mapped.trade) ||
      TRADE_KEYWORD_MAP.some(
        (entry) =>
          entry.trade === mapped.trade && entry.pattern.test(narrative),
      );

    if (!stillRelevant) {
      continue;
    }

    // Do not reintroduce elevator rows without confirmation.
    if (isElevatorLine(mapped)) {
      continue;
    }

    merged.push(mapped);
    presentTrades.add(mapped.trade);
  }

  return merged;
}

export function buildEstimateUserContext(input: {
  title: string;
  description: string | null;
  projectType: string;
  propertyType: string | null;
  district: string | null;
  regionCode: string;
  tagSlugs: string[];
  brief: ProjectBriefV1;
  previousLines?: EstimateLine[];
}) {
  return {
    project: {
      title: input.title,
      description: input.description,
      projectType: input.projectType,
      propertyType: input.propertyType,
      district: input.district,
      regionCode: input.regionCode,
      tags: input.tagSlugs,
    },
    brief: {
      summary: input.brief.summary,
      packages: input.brief.packages,
      property: input.brief.property,
      materials: input.brief.materials,
      design: input.brief.design,
      timeline: input.brief.timeline,
      constraints: input.brief.constraints,
      documentInsights: input.brief.ai?.documentInsights,
    },
    intakeAnswers: formatIntakeAnswersForEstimate(input.brief),
    ...(input.previousLines && input.previousLines.length > 0
      ? {
          previousEstimate: {
            lines: input.previousLines,
            guidance:
              'Revise this estimate for the current scope. Keep still-relevant trades; add new ones; do not collapse to only the newest items.',
          },
        }
      : {}),
  };
}
