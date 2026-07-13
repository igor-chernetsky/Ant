import { ProjectBriefV1 } from '../projects/project-brief';
import { EstimateLine } from './estimates.types';
import { TH_REGIONAL_CATALOG } from './regional-catalog';

export const ALLOWED_ESTIMATE_TRADES = new Set(
  TH_REGIONAL_CATALOG.map((item) => item.trade),
);

const ELEVATOR_PATTERN =
  /\b(elevator|elevators|lift|lifts|лифт|лифты|passenger\s+lift)\b/i;

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
): string {
  const allowed = catalogTradeSlugs().join(', ');
  const lines = [
    `trade on each line MUST be one of: ${allowed}. Do not invent new trade slugs.`,
    'Only include scope that is explicitly stated or clearly implied by project data and intake answers.',
    'If a major system (elevator, pool, basement, facade access equipment) is uncertain, omit it from lines — it should be clarified in intake instead.',
  ];

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

function mapLineToCatalogTrade(line: EstimateLine): EstimateLine | null {
  const trade = line.trade.trim().toLowerCase();
  if (ALLOWED_ESTIMATE_TRADES.has(trade)) {
    return line;
  }

  const description = `${line.trade} ${line.description}`.toLowerCase();

  const keywordMap: Array<{ pattern: RegExp; trade: string }> = [
    { pattern: ELEVATOR_PATTERN, trade: 'structural' },
    { pattern: /\b(pool|swimming)\b/i, trade: 'structural' },
    { pattern: /\b(foundation|footing|pile)\b/i, trade: 'structural' },
    { pattern: /\b(roof|roofing)\b/i, trade: 'roofing' },
    { pattern: /\b(electric|wiring)\b/i, trade: 'electrical' },
    { pattern: /\b(plumb|sanitary|pipe)\b/i, trade: 'plumbing' },
    { pattern: /\b(hvac|air\s*con|a\/c)\b/i, trade: 'hvac' },
    { pattern: /\b(paint)\b/i, trade: 'painting' },
    { pattern: /\b(tile|tiling)\b/i, trade: 'tiling' },
    { pattern: /\b(floor)\b/i, trade: 'flooring' },
    { pattern: /\b(window|door)\b/i, trade: 'windows-doors' },
    { pattern: /\b(design|architect)\b/i, trade: 'design' },
    { pattern: /\b(demolition|strip)\b/i, trade: 'demolition' },
    { pattern: /\b(finish|fitout|fit-out)\b/i, trade: 'finishing' },
  ];

  for (const mapping of keywordMap) {
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

  return null;
}

export function filterEstimateLines(input: {
  lines: EstimateLine[];
  projectType: string;
  propertyType: string | null;
  description: string | null;
  brief: ProjectBriefV1;
}): EstimateLine[] {
  const filtered: EstimateLine[] = [];

  for (const rawLine of input.lines) {
    const line = mapLineToCatalogTrade(rawLine);
    if (!line) {
      continue;
    }

    const combined = `${line.trade} ${line.description}`;

    if (
      ELEVATOR_PATTERN.test(combined) &&
      !intakeConfirmsSpecialSystem(input.brief, input.description, ELEVATOR_PATTERN)
    ) {
      continue;
    }

    if (
      (input.propertyType === 'house' || input.propertyType === 'apartment') &&
      ELEVATOR_PATTERN.test(combined) &&
      input.projectType !== 'commercial_fitout'
    ) {
      continue;
    }

    filtered.push(line);
  }

  return filtered;
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
  };
}
