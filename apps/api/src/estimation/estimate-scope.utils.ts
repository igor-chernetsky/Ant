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
  'fire-suppression',
  'piling',
  'earthwork',
  'low-voltage',
  'built-in-furniture',
  'plastering',
  'ceilings',
]);

export const FIRE_SUPPRESSION_PATTERN =
  /\b(fire[-\s]?protect|fire[-\s]?suppress|fire[-\s]?extinguish|sprinkler|пожар(отушен|ной\s*безопас|озащит)|автоматическ\w*\s*пожар|ระบบดับเพลิง|ระบบป้องกันอัคคีภัย)\b/i;

export const INDUSTRIAL_VENTILATION_PATTERN =
  /\b(supply[\s\-/]*exhaust|приточн\w*\s*-?\s*вытяж|приточно-вытяж|industrial\s*ventil|warehouse\s*ventil|вентиляц(ия|ии|ионн)|exhaust\s*ventil|механическ\w*\s*вентиляц)\b/i;

const WAREHOUSE_OR_PRODUCTION_PATTERN =
  /\b(warehouse|склад|factory|завод|производств|woodwork|деревообработ|furniture\s*product|мебельн\w*\s*производ|industrial|промышленн)\b/i;

const HEAVY_ELECTRICAL_LOAD_PATTERN =
  /\b(cnc|heavy\s*machin|high[- ]?voltage|process\s*equipment|промышленн\w*\s*(нагруз|электр)|силовое\s*оборуд|станок|substation|трансформатор)\b/i;

/** Industrial supply/exhaust ventilation priced per sqm (THB). */
export const INDUSTRIAL_HVAC_SQM_MIN = 1200;
export const INDUSTRIAL_HVAC_SQM_MAX = 3200;

/**
 * Warehouse / light-industrial electrical (lighting, sockets, small boards)
 * without heavy process equipment — far below residential fit-out bands.
 */
export const WAREHOUSE_ELECTRICAL_SQM_MIN = 550;
export const WAREHOUSE_ELECTRICAL_SQM_MAX = 1600;

/** Shell trades that must be priced on GFA, never as qty=1 catalog lumps. */
const SQM_SHELL_TRADES = new Set(['structural', 'roofing', 'flooring']);

const APPROX_AREA_BUCKET_SQM: Record<string, number> = {
  'under-30': 25,
  '30-80': 55,
  '80-150': 115,
  '150-plus': 220,
};

/** Explicitly requested extras that are not a dedicated catalog trade → `other`. */
const REQUESTED_OTHER_SYSTEMS: Array<{
  id: string;
  pattern: RegExp;
  description: string;
}> = [
  {
    id: 'fire-alarm',
    pattern:
      /\b(fire\s*alarm|пожар\w*\s*сигнализ|smoke\s*detect|дымов\w*\s*извещ)\b/i,
    description: 'Fire alarm / detection system',
  },
];

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
  options?: { landscapingOrCivilAmenityOnly?: boolean },
): string {
  const allowed = catalogTradeSlugs().join(', ');
  const landscapingOnly = options?.landscapingOrCivilAmenityOnly === true;
  const lines = [
    `trade on each line MUST be one of: ${allowed}. Do not invent new trade slugs.`,
    'Only include scope that is explicitly stated or clearly implied by project data and intake answers.',
    landscapingOnly
      ? 'Primary scope is landscaping / civil amenity (path, paving, fence, yard works). Price confirmed outdoor civil/landscaping work only — do NOT invent building shell, indoor MEP, sanitary wet points, or storeys.'
      : 'If a major system (elevator, pool, basement, facade access equipment) is uncertain, omit it from lines — it should be clarified in intake instead.',
    landscapingOnly
      ? 'improvementQuestions must address amenity gaps only (dimensions/width, base/site prep, materials/finish, drainage/edging, outdoor lighting if relevant). NEVER ask about building storeys, sanitary wet points, foundations of a house, or indoor plumbing.'
      : 'MEP must be priced in depth when confirmed: prefer separate lines for (1) base electrical / plumbing, (2) external utility connections, (3) specialty lighting fixtures, (4) premium water treatment / filtration — not one shallow aggregate.',
  ];

  if (!landscapingOnly) {
    lines.push(
      'Price lighting fixtures and water-supply utility connection realistically for Thailand — prefer mid-to-high of catalog bands; do not underprice networks.',
      'Quality upgrades mentioned in description, intake answers, or amendments (chlorine-free / UV / ozone / salt treatment; specialty / underwater / designer lights) MUST increase unit prices and/or add dedicated lines. Changing only the line description without changing amounts is incorrect.',
      'Civil / landscaping additions (paths, umbrella footings, concrete pads) and MEP quality upgrades must BOTH move totals — never ignore MEP notes while pricing concrete.',
      'Cover confirmed MEP (electrical, plumbing) whenever wiring, lighting, fixtures, water supply, sanitary, filtration, or utility connection works are in scope.',
      'When the client (description, amendments, intake) requests a new system — fire protection/sprinklers, specialty MEP, or other named equipment — ADD a separate priced estimate line. Use trade fire-suppression for fire protection / extinguishing; use trade other for explicitly requested systems that are not a catalog trade. Never only mention them in description text.',
      'Do not remap fire-suppression or other lines into finishing.',
      'Supply/exhaust or industrial/warehouse ventilation must be priced as HVAC per sqm (roughly 1,200–3,200 THB/sqm), not as a single residential AC unit (18–45k).',
      'Prefer a single consolidated electrical line for base wiring/board/lighting; avoid duplicate electrical rows that inflate totals.',
    );
  } else {
    lines.push(
      'Prefer civil/landscaping trades (and finishing only when paving/tile finishes are confirmed). Include site preparation when the ground is unprepared.',
      'Do not add electrical/plumbing lines unless lighting or utilities are explicitly in scope.',
    );
  }

  if (hasPreviousEstimate) {
    lines.push(
      'A previousEstimate is provided. REVISE it for the updated scope: keep still-relevant trades, adjust quantities/prices as needed, and ADD lines for new work. Do NOT drop construction, finishing, or electrical lines just because newer items (tiling, furniture, umbrellas) were added.',
      'When an amendment adds premium equipment/systems (treatment, specialty lighting, fire suppression, or other named systems), INCREASE related previous line amounts or add new dedicated lines — do not leave totals unchanged.',
      'Only remove a previous trade if the updated scope clearly cancels that work.',
    );
  }

  if (!landscapingOnly && propertyType === 'residential') {
    lines.push(
      'For residential projects: do NOT include elevators, lifts, podium works, or commercial-scale building services unless intake answers or description explicitly require them.',
    );
  }

  if (
    !landscapingOnly &&
    projectType === 'new_build' &&
    propertyType === 'residential'
  ) {
    lines.push(
      'Typical single-family new build: structural, roofing, MEP (electrical, plumbing, hvac), windows-doors, finishing — not passenger elevators unless confirmed.',
    );
  }

  if (
    !landscapingOnly &&
    (projectType === 'new_build' || projectType === 'extension')
  ) {
    lines.push(
      'For new build / extension: if intake foundation-type is set (slab, strip, piles, undecided) and is not already_exists, include foundation works in structural scope (dedicated structural line or clear foundation quantity) — do not omit foundations because they were not repeated in the free-text description.',
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
  {
    pattern: FIRE_SUPPRESSION_PATTERN,
    trade: 'fire-suppression',
  },
  {
    pattern: /\b(pil(e|ing)|bored\s*pile|micropile|свай|เสาเข็ม)\b/i,
    trade: 'piling',
  },
  {
    pattern:
      /\b(excavation|earthwork|digging|котлован|земляны|ขุดดิน)\b/i,
    trade: 'earthwork',
  },
  {
    pattern:
      /\b(low[-\s]?voltage|weak\s*current|cctv|access\s*control|data\s*cabl|скуд|видео.?наблюд|слаботоч)\b/i,
    trade: 'low-voltage',
  },
  {
    pattern:
      /\b(built[-\s]?in\s*furnitur|cabinet|встроенн\w*\s*мебел|ตู้บิ้วอิน)\b/i,
    trade: 'built-in-furniture',
  },
  {
    pattern: /\b(plaster|render(ing)?|штукатур|ฉาบปูน)\b/i,
    trade: 'plastering',
  },
  {
    pattern:
      /\b(ceilings?|false\s*ceiling|suspended\s*ceiling|потолк|ฝ้าเพดาน)\b/i,
    trade: 'ceilings',
  },
  { pattern: /\b(roof|roofing|кровл|крыш)\b/i, trade: 'roofing' },
  {
    pattern:
      /\b(electric|wiring|lighting|свет|освещ|электро|электрик|проводк|светильник|underwater\s*light)\b/i,
    trade: 'electrical',
  },
  {
    pattern:
      /\b(plumb|sanitary|pipe|water\s*supply|водоснаб|водопровод|сантех|канализ|chlorine|без\s*хлор|filtration|фильтр|uv\s*treat|озон)\b/i,
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
  { pattern: /\b(carpent|joinery|столяр)\b/i, trade: 'carpentry' },
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

  // Soft fallback: keep priced unknown trades as `other` rather than folding into finishing.
  if (line.lineMin > 0 || line.lineMax > 0) {
    return {
      ...line,
      trade: 'other',
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
      input.propertyType === 'residential' &&
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

function catalogLumpLine(
  trade: string,
  description: string,
): EstimateLine | null {
  const catalog = TH_REGIONAL_CATALOG.find((item) => item.trade === trade);
  if (!catalog) {
    return null;
  }
  return {
    trade,
    description,
    quantity: 1,
    unit: catalog.unit,
    unitPriceMin: catalog.priceMinThb,
    unitPriceMax: catalog.priceMaxThb,
    lineMin: catalog.priceMinThb,
    lineMax: catalog.priceMaxThb,
  };
}

function lineCoversTradeOrPattern(
  lines: EstimateLine[],
  trade: string,
  pattern: RegExp,
): boolean {
  return lines.some(
    (line) =>
      line.trade === trade ||
      pattern.test(`${line.trade} ${line.description}`),
  );
}

/**
 * After AI/fallback generation, ensure explicitly requested specialty systems
 * appear as dedicated priced lines (not description-only notes).
 */
export function ensureRequestedExtraLines(input: {
  lines: EstimateLine[];
  narrative: string;
  tagSlugs: string[];
}): EstimateLine[] {
  const next = [...input.lines];
  const narrative = input.narrative;
  const wantsFire =
    input.tagSlugs.includes('fire-suppression') ||
    FIRE_SUPPRESSION_PATTERN.test(narrative);

  if (
    wantsFire &&
    !lineCoversTradeOrPattern(next, 'fire-suppression', FIRE_SUPPRESSION_PATTERN)
  ) {
    const line = catalogLumpLine(
      'fire-suppression',
      'Automatic fire suppression / sprinkler system',
    );
    if (line) {
      next.push(line);
    }
  }

  for (const system of REQUESTED_OTHER_SYSTEMS) {
    if (!system.pattern.test(narrative)) {
      continue;
    }
    if (lineCoversTradeOrPattern(next, 'other', system.pattern)) {
      continue;
    }
    // Skip if already covered under another trade with matching description.
    if (next.some((line) => system.pattern.test(line.description))) {
      continue;
    }
    const line = catalogLumpLine('other', system.description);
    if (line) {
      next.push(line);
    }
  }

  return next;
}

/** Resolve GFA for pricing: brief → WxH dimensions → intake buckets → default. */
export function resolveEstimateAreaSqm(
  brief: ProjectBriefV1,
  narrative: string,
): number {
  const fromBrief = brief.property?.areaSqm;
  if (typeof fromBrief === 'number' && fromBrief > 0) {
    return Math.round(fromBrief);
  }

  const fromPackage = brief.packages?.find(
    (pkg) => typeof pkg.areaSqm === 'number' && (pkg.areaSqm ?? 0) > 0,
  )?.areaSqm;
  if (typeof fromPackage === 'number' && fromPackage > 0) {
    return Math.round(fromPackage);
  }

  const fromDimensions = parseAreaFromDimensions(narrative);
  if (fromDimensions) {
    return fromDimensions;
  }

  const fromExplicit = parseExplicitSqm(narrative);
  if (fromExplicit) {
    return fromExplicit;
  }

  const approxAnswer = brief.ai?.intake?.answers?.find(
    (entry) => entry.questionId === 'approx-area' && !entry.skipped,
  );
  if (approxAnswer) {
    const raw = Array.isArray(approxAnswer.value)
      ? String(approxAnswer.value[0] ?? '')
      : String(approxAnswer.value ?? '');
    const bucket = APPROX_AREA_BUCKET_SQM[raw];
    if (bucket) {
      return bucket;
    }
    const custom = parseExplicitSqm(approxAnswer.customText ?? '');
    if (custom) {
      return custom;
    }
  }

  return 50;
}

function parseAreaFromDimensions(text: string): number | null {
  const match = text.match(
    /(\d+(?:[.,]\d+)?)\s*[x×х]\s*(\d+(?:[.,]\d+)?)\s*(?:m|м|meter|metre|meters|metres)?/i,
  );
  if (!match) {
    return null;
  }
  const a = Number(match[1].replace(',', '.'));
  const b = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return null;
  }
  const area = Math.round(a * b);
  // Ignore tiny product dimensions (e.g. 2x4 lumber) and absurd values.
  if (area < 20 || area > 20000) {
    return null;
  }
  return area;
}

function parseExplicitSqm(text: string): number | null {
  const match = text.match(
    /(\d+(?:[.,]\d+)?)\s*(?:sqm|sq\.?\s*m|m2|m²|кв\.?\s*м|м\s*2)/i,
  );
  if (!match) {
    return null;
  }
  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value < 10 || value > 20000) {
    return null;
  }
  return Math.round(value);
}

export function wantsIndustrialVentilation(narrative: string): boolean {
  if (INDUSTRIAL_VENTILATION_PATTERN.test(narrative)) {
    return true;
  }
  // Warehouse/production + generic ventilation / HVAC mention.
  return (
    WAREHOUSE_OR_PRODUCTION_PATTERN.test(narrative) &&
    /\b(ventil|вентиляц|hvac|air\s*con|кондиц)\b/i.test(narrative)
  );
}

function warehouseLikeForPricing(narrative: string): boolean {
  return (
    WAREHOUSE_OR_PRODUCTION_PATTERN.test(narrative) &&
    !HEAVY_ELECTRICAL_LOAD_PATTERN.test(narrative)
  );
}

/**
 * Reprice under-costed unit HVAC when industrial supply/exhaust ventilation is in scope.
 */
export function normalizeIndustrialHvacLines(input: {
  lines: EstimateLine[];
  narrative: string;
  areaSqm: number;
}): EstimateLine[] {
  if (!wantsIndustrialVentilation(input.narrative)) {
    return input.lines;
  }

  const areaSqm = Math.max(20, input.areaSqm);
  const targetMin = Math.round(INDUSTRIAL_HVAC_SQM_MIN * areaSqm);
  const targetMax = Math.round(INDUSTRIAL_HVAC_SQM_MAX * areaSqm);
  const description =
    'Supply and exhaust industrial ventilation system';

  const next = [...input.lines];
  const hvacIndexes = next
    .map((line, index) => (line.trade === 'hvac' ? index : -1))
    .filter((index) => index >= 0);

  if (hvacIndexes.length === 0) {
    next.push({
      trade: 'hvac',
      description,
      quantity: areaSqm,
      unit: 'sqm',
      unitPriceMin: INDUSTRIAL_HVAC_SQM_MIN,
      unitPriceMax: INDUSTRIAL_HVAC_SQM_MAX,
      lineMin: targetMin,
      lineMax: targetMax,
    });
    return next;
  }

  // Keep one HVAC line; reprice if still at residential unit scale.
  const primaryIndex = hvacIndexes[0];
  const primary = next[primaryIndex];
  const underpriced =
    primary.unit === 'unit' ||
    primary.lineMax < Math.round(areaSqm * INDUSTRIAL_HVAC_SQM_MIN * 0.5);

  next[primaryIndex] = {
    ...primary,
    description:
      INDUSTRIAL_VENTILATION_PATTERN.test(primary.description) || underpriced
        ? description
        : primary.description,
    quantity: underpriced ? areaSqm : primary.quantity,
    unit: underpriced ? 'sqm' : primary.unit,
    unitPriceMin: underpriced
      ? INDUSTRIAL_HVAC_SQM_MIN
      : Math.max(primary.unitPriceMin, INDUSTRIAL_HVAC_SQM_MIN),
    unitPriceMax: underpriced
      ? INDUSTRIAL_HVAC_SQM_MAX
      : Math.max(primary.unitPriceMax, INDUSTRIAL_HVAC_SQM_MAX),
    lineMin: underpriced
      ? targetMin
      : Math.max(primary.lineMin, targetMin),
    lineMax: underpriced
      ? targetMax
      : Math.max(primary.lineMax, targetMax),
  };

  // Drop duplicate HVAC rows after consolidating.
  for (let i = hvacIndexes.length - 1; i >= 1; i -= 1) {
    next.splice(hvacIndexes[i], 1);
  }

  return next;
}

/**
 * AI sometimes returns shell trades as qty=1 × catalog unit rates after a
 * height/geometry answer (e.g. structural 2,500–5,500 THB total). Rescale to GFA.
 */
export function normalizeUnderpricedSqmShellLines(input: {
  lines: EstimateLine[];
  areaSqm: number;
}): EstimateLine[] {
  const areaSqm = Math.max(20, input.areaSqm);

  return input.lines.map((line) => {
    if (!SQM_SHELL_TRADES.has(line.trade)) {
      return line;
    }

    const catalog = TH_REGIONAL_CATALOG.find((item) => item.trade === line.trade);
    if (!catalog || catalog.unit !== 'sqm') {
      return line;
    }

    const catalogMin = catalog.priceMinThb;
    const catalogMax = catalog.priceMaxThb;
    const floorTotal = Math.round(catalogMin * areaSqm * 0.45);
    const looksLikeUnitLump =
      line.quantity <= 5 ||
      (line.unit !== 'sqm' && line.quantity < areaSqm * 0.25) ||
      line.lineMax < floorTotal ||
      (line.unit === 'sqm' &&
        line.quantity < areaSqm * 0.25 &&
        line.lineMax <= catalogMax * 3);

    if (!looksLikeUnitLump) {
      // Still enforce quantity ≈ area when unit is sqm but qty drifted to height (e.g. 6–12).
      if (
        line.unit === 'sqm' &&
        line.quantity > 0 &&
        line.quantity < areaSqm * 0.25 &&
        line.quantity <= 30
      ) {
        const unitPriceMin = Math.min(
          catalogMax,
          Math.max(catalogMin, line.unitPriceMin || catalogMin),
        );
        const unitPriceMax = Math.max(
          unitPriceMin,
          Math.min(catalogMax * 1.15, line.unitPriceMax || catalogMax),
        );
        return {
          ...line,
          quantity: areaSqm,
          unit: 'sqm',
          unitPriceMin,
          unitPriceMax,
          lineMin: Math.round(unitPriceMin * areaSqm),
          lineMax: Math.round(unitPriceMax * areaSqm),
        };
      }
      return line;
    }

    const unitPriceMin = Math.min(
      catalogMax,
      Math.max(catalogMin, line.unitPriceMin || catalogMin),
    );
    const unitPriceMax = Math.max(
      unitPriceMin,
      Math.min(catalogMax * 1.15, line.unitPriceMax || catalogMax),
    );

    return {
      ...line,
      quantity: areaSqm,
      unit: 'sqm',
      unitPriceMin,
      unitPriceMax,
      lineMin: Math.round(unitPriceMin * areaSqm),
      lineMax: Math.round(unitPriceMax * areaSqm),
    };
  });
}

/**
 * Merge duplicate electrical rows and apply band caps.
 * Warehouse/light-industrial without heavy process load uses a much lower
 * ฿/sqm band than residential fit-out (catalog 2,200–6,500).
 */
export function dedupeAndCapElectricalLines(input: {
  lines: EstimateLine[];
  narrative: string;
  areaSqm: number;
}): EstimateLine[] {
  const electrical = input.lines.filter((line) => line.trade === 'electrical');
  const others = input.lines.filter((line) => line.trade !== 'electrical');
  if (electrical.length === 0) {
    return input.lines;
  }

  const areaSqm = Math.max(20, input.areaSqm);
  const catalog = TH_REGIONAL_CATALOG.find((item) => item.trade === 'electrical');
  const catalogMax = catalog?.priceMaxThb ?? 6500;
  const catalogMin = catalog?.priceMinThb ?? 2200;

  const heavyLoad = HEAVY_ELECTRICAL_LOAD_PATTERN.test(input.narrative);
  const warehouseLike =
    WAREHOUSE_OR_PRODUCTION_PATTERN.test(input.narrative) && !heavyLoad;

  const bandMin = warehouseLike ? WAREHOUSE_ELECTRICAL_SQM_MIN : catalogMin;
  const bandMax = warehouseLike
    ? WAREHOUSE_ELECTRICAL_SQM_MAX
    : heavyLoad
      ? catalogMax * 1.5
      : catalogMax * 1.25;

  const descriptions = [
    ...new Set(
      electrical
        .map((line) => line.description.trim())
        .filter((text) => text.length > 0),
    ),
  ];
  const quantity = Math.max(
    areaSqm,
    ...electrical.map((line) =>
      line.unit === 'sqm' && line.quantity > 0 ? line.quantity : areaSqm,
    ),
  );

  const modelMin = Math.min(...electrical.map((line) => line.unitPriceMin));
  const modelMax = Math.max(...electrical.map((line) => line.unitPriceMax));

  let unitPriceMin: number;
  let unitPriceMax: number;

  if (warehouseLike) {
    // Pull residential-scale model rates down into the warehouse band.
    const rawMin = Number.isFinite(modelMin) ? modelMin : bandMin;
    const rawMax = Number.isFinite(modelMax) ? modelMax : bandMax;
    unitPriceMin = Math.max(bandMin, Math.min(bandMax, rawMin));
    unitPriceMax = Math.max(unitPriceMin, Math.min(bandMax, rawMax));
    if (rawMin > bandMax * 1.2 || rawMax > bandMax * 1.2) {
      unitPriceMin = bandMin;
      unitPriceMax = bandMax;
    }
  } else {
    unitPriceMin = Math.max(bandMin, Number.isFinite(modelMin) ? modelMin : bandMin);
    unitPriceMax = Math.max(
      unitPriceMin,
      Math.min(bandMax, Number.isFinite(modelMax) ? modelMax : bandMax),
    );
  }

  let lineMin = Math.round(unitPriceMin * quantity);
  let lineMax = Math.round(unitPriceMax * quantity);
  const capMax = Math.round(bandMax * areaSqm);
  const capMin = Math.round(bandMin * areaSqm);

  if (lineMax > capMax) {
    lineMax = capMax;
    unitPriceMax = Math.round(capMax / quantity);
  }
  if (lineMin < capMin) {
    lineMin = capMin;
    unitPriceMin = Math.round(lineMin / quantity);
  }
  if (lineMin > lineMax) {
    lineMin = Math.round(lineMax * 0.7);
    unitPriceMin = Math.round(lineMin / quantity);
  }

  return [
    ...others,
    {
      trade: 'electrical',
      description:
        descriptions.length > 0
          ? descriptions.join('; ').slice(0, 500)
          : 'Electrical works (wiring, panel, lighting)',
      quantity,
      unit: 'sqm',
      unitPriceMin,
      unitPriceMax: Math.max(unitPriceMin, unitPriceMax),
      lineMin: Math.min(lineMin, lineMax),
      lineMax: Math.max(lineMin, lineMax),
    },
  ];
}

/**
 * Shared post-processing after filter/merge for OpenAI and fallback paths.
 */
export function finalizeEstimateLines(input: {
  lines: EstimateLine[];
  narrative: string;
  tagSlugs: string[];
  brief: ProjectBriefV1;
}): EstimateLine[] {
  const areaSqm = resolveEstimateAreaSqm(input.brief, input.narrative);
  const ensured = ensureRequestedExtraLines({
    lines: input.lines,
    narrative: input.narrative,
    tagSlugs: input.tagSlugs,
  });
  const hvacNormalized = normalizeIndustrialHvacLines({
    lines: ensured,
    narrative: input.narrative,
    areaSqm,
  });
  const shellNormalized = normalizeUnderpricedSqmShellLines({
    lines: hvacNormalized,
    areaSqm,
  });
  const signals = detectPremiumScopeSignals(input.narrative);
  const premiumAdjusted = applyPremiumScopePriceAdjustments(
    shellNormalized,
    signals,
  );
  return dedupeAndCapElectricalLines({
    lines: premiumAdjusted,
    narrative: input.narrative,
    areaSqm,
  });
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
  clarificationQa?: Array<{ question: string; answer: string }>;
  clarificationSummary?: string | null;
  scopeSummary?: string | null;
  estimateRefinementQa?: Array<{ question: string; answer: string }>;
}) {
  const narrative = collectEstimateNarrative(input);
  const premiumSignals = detectPremiumScopeSignals(narrative);
  const areaSqm = resolveEstimateAreaSqm(input.brief, narrative);
  const hasClarifications =
    (input.clarificationQa?.length ?? 0) > 0 ||
    Boolean(input.clarificationSummary?.trim());
  const hasRefinement =
    (input.estimateRefinementQa?.length ?? 0) > 0;

  const pricingDirectives = buildPricingDirectives(premiumSignals);
  if (wantsIndustrialVentilation(narrative)) {
    pricingDirectives.push(
      `Supply/exhaust or industrial ventilation is in scope — price HVAC per sqm (~${INDUSTRIAL_HVAC_SQM_MIN}–${INDUSTRIAL_HVAC_SQM_MAX} THB/sqm × ~${areaSqm} sqm), not as a single residential AC unit.`,
    );
  }
  pricingDirectives.push(
    `Use resolvedAreaSqm=${areaSqm} as quantity for structural, roofing, flooring, and other sqm shell trades. Never use building height (metres) or quantity=1 for those trades.`,
  );
  if (warehouseLikeForPricing(narrative)) {
    pricingDirectives.push(
      `Warehouse/light-industrial electrical without heavy process equipment: price ~${WAREHOUSE_ELECTRICAL_SQM_MIN}–${WAREHOUSE_ELECTRICAL_SQM_MAX} THB/sqm (lighting/sockets/boards), not residential fit-out rates.`,
    );
  }

  return {
    project: {
      title: input.title,
      description: input.description,
      projectType: input.projectType,
      propertyType: input.propertyType,
      district: input.district,
      regionCode: input.regionCode,
      tags: input.tagSlugs,
      scopeSummary: input.scopeSummary ?? null,
      resolvedAreaSqm: areaSqm,
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
    clarificationQa: input.clarificationQa ?? [],
    clarificationSummary: input.clarificationSummary ?? null,
    estimateRefinementQa: input.estimateRefinementQa ?? [],
    premiumScopeSignals: premiumSignals,
    pricingDirectives,
    ...(input.previousLines && input.previousLines.length > 0
      ? {
          previousEstimate: {
            lines: input.previousLines,
            guidance:
              hasClarifications || hasRefinement
                ? 'Scope was clarified or refined after the previous estimate. RECALCULATE amounts for affected trades. Do not drop still-confirmed lines. Do not copy previous amounts unchanged when new facts were added.'
                : 'Revise this estimate for the current scope. Keep still-relevant trades; add new ones; do not collapse to only the newest items. Premium MEP notes must raise electrical/plumbing amounts.',
          },
        }
      : {}),
  };
}

export function collectEstimateNarrative(input: {
  title: string;
  description: string | null;
  tagSlugs: string[];
  brief: ProjectBriefV1;
  clarificationQa?: Array<{ question: string; answer: string }>;
  clarificationSummary?: string | null;
  scopeSummary?: string | null;
  estimateRefinementQa?: Array<{ question: string; answer: string }>;
}): string {
  const insightText = (input.brief.ai?.documentInsights ?? [])
    .map((insight) =>
      [
        insight.fileName,
        insight.summary,
        ...(insight.keyFacts ?? []),
        insight.omittedNote ?? '',
      ].join(' '),
    )
    .join(' ');

  return [
    input.title,
    input.description ?? '',
    input.scopeSummary ?? '',
    input.brief.summary ?? '',
    input.brief.constraints ?? '',
    input.clarificationSummary ?? '',
    insightText,
    ...(input.brief.packages ?? []).map((pkg) => pkg.description ?? ''),
    ...input.tagSlugs,
    ...formatIntakeAnswersForEstimate(input.brief).map(
      (row) => `${row.questionId} ${row.answer}`,
    ),
    ...(input.clarificationQa ?? []).map(
      (row) => `${row.question} ${row.answer}`,
    ),
    ...(input.estimateRefinementQa ?? []).map(
      (row) => `${row.question} ${row.answer}`,
    ),
  ]
    .join(' ')
    .trim();
}

export interface PremiumScopeSignals {
  chlorineFreeOrAltTreatment: boolean;
  specialtyOrUnderwaterLighting: boolean;
  externalUtilityConnection: boolean;
  saltTreatment: boolean;
}

export function detectPremiumScopeSignals(
  narrative: string,
): PremiumScopeSignals {
  const text = narrative.toLowerCase();
  const chlorineFreeOrAltTreatment =
    /chlorine[- ]?free|без\s*хлор|uv(\s|\/|-)?(treat|ozone|систем)|озон|ultraviolet|ультрафиолет|pool-water-treatment\s*(uv-ozone|salt)|uv-ozone/.test(
      text,
    );
  const saltTreatment =
    /\bsalt(\s|-)?(water|chlorin|system)|солев|pool-water-treatment\s*salt\b/.test(
      text,
    );
  const specialtyOrUnderwaterLighting =
    /specialty[- ]?lighting|подводн|underwater\s*light|designer\s*(light|fixture|светильник)|специальн\w*\s*светильник|rgb\s*(light|pool)|pool-lighting\s*(specialty|basic)|electrical-scope[^\n]*specialty/.test(
      text,
    );
  const externalUtilityConnection =
    /utility-connections[^\n]*(power|water|sewer)|подключен\w*\s*(к\s*)?(сет|электр|вод|канал)|mains\s*(water|sewer|power)|внешн\w*\s*(сет|ввод)|grid\s*connection/.test(
      text,
    );

  return {
    chlorineFreeOrAltTreatment,
    specialtyOrUnderwaterLighting,
    externalUtilityConnection,
    saltTreatment,
  };
}

function buildPricingDirectives(signals: PremiumScopeSignals): string[] {
  const directives: string[] = [];
  if (signals.chlorineFreeOrAltTreatment) {
    directives.push(
      'Chlorine-free / UV / ozone treatment is confirmed — add or raise a plumbing (or dedicated filtration) line by roughly 80,000–250,000 THB; do not leave plumbing totals unchanged.',
    );
  }
  if (signals.saltTreatment && !signals.chlorineFreeOrAltTreatment) {
    directives.push(
      'Salt chlorination is confirmed — price above basic chlorine filtration (typically +40,000–120,000 THB on plumbing).',
    );
  }
  if (signals.specialtyOrUnderwaterLighting) {
    directives.push(
      'Specialty / underwater / designer lighting is confirmed — raise electrical fixtures to upper catalog band or add a dedicated lighting lump (+40,000–180,000 THB); wording-only updates are invalid.',
    );
  }
  if (signals.externalUtilityConnection) {
    directives.push(
      'External utility connections are confirmed — include connection lumps for power and/or water/sewer near upper plumbing/electrical guidance, not just internal points.',
    );
  }
  return directives;
}

/**
 * Deterministic floors so premium MEP notes cannot be ignored the way concrete path notes raise civil lines.
 */
export function applyPremiumScopePriceAdjustments(
  lines: EstimateLine[],
  signals: PremiumScopeSignals,
): EstimateLine[] {
  if (
    !signals.chlorineFreeOrAltTreatment &&
    !signals.saltTreatment &&
    !signals.specialtyOrUnderwaterLighting &&
    !signals.externalUtilityConnection
  ) {
    return lines;
  }

  let next = lines.map((line) => ({ ...line }));

  const bumpTrade = (
    trade: string,
    factorMin: number,
    factorMax: number,
    minLineBump: number,
  ) => {
    const indexes = next
      .map((line, index) => (line.trade === trade ? index : -1))
      .filter((index) => index >= 0);
    if (indexes.length === 0) {
      return;
    }
    for (const index of indexes) {
      const line = next[index];
      const unitPriceMin = Math.max(
        line.unitPriceMin,
        Math.round(line.unitPriceMin * factorMin),
      );
      const unitPriceMax = Math.max(
        line.unitPriceMax,
        Math.round(line.unitPriceMax * factorMax),
        unitPriceMin,
      );
      let lineMin = Math.max(
        line.lineMin,
        Math.round(unitPriceMin * line.quantity),
        Math.round(line.lineMin * factorMin),
      );
      let lineMax = Math.max(
        line.lineMax,
        Math.round(unitPriceMax * line.quantity),
        Math.round(line.lineMax * factorMax),
        lineMin,
      );
      if (lineMax - line.lineMax < minLineBump / indexes.length) {
        const share = Math.round(minLineBump / indexes.length);
        lineMin += Math.round(share * 0.7);
        lineMax += share;
      }
      next[index] = {
        ...line,
        unitPriceMin,
        unitPriceMax,
        lineMin,
        lineMax,
      };
    }
  };

  if (signals.specialtyOrUnderwaterLighting) {
    bumpTrade('electrical', 1.35, 1.55, 60000);
  }

  if (signals.chlorineFreeOrAltTreatment) {
    bumpTrade('plumbing', 1.45, 1.7, 120000);
  } else if (signals.saltTreatment) {
    bumpTrade('plumbing', 1.25, 1.4, 60000);
  }

  if (signals.externalUtilityConnection) {
    bumpTrade('electrical', 1.15, 1.25, 40000);
    bumpTrade('plumbing', 1.2, 1.35, 50000);
  }

  // If premium treatment exists but no plumbing line, synthesize a lump.
  if (
    (signals.chlorineFreeOrAltTreatment || signals.saltTreatment) &&
    !next.some((line) => line.trade === 'plumbing')
  ) {
    const lumpMin = signals.chlorineFreeOrAltTreatment ? 90000 : 45000;
    const lumpMax = signals.chlorineFreeOrAltTreatment ? 220000 : 120000;
    next.push({
      trade: 'plumbing',
      description: signals.chlorineFreeOrAltTreatment
        ? 'Premium water treatment (chlorine-free / UV / ozone)'
        : 'Salt chlorination / enhanced filtration',
      quantity: 1,
      unit: 'lump',
      unitPriceMin: lumpMin,
      unitPriceMax: lumpMax,
      lineMin: lumpMin,
      lineMax: lumpMax,
    });
  }

  if (
    signals.specialtyOrUnderwaterLighting &&
    !next.some((line) => line.trade === 'electrical')
  ) {
    next.push({
      trade: 'electrical',
      description: 'Specialty / underwater lighting fixtures',
      quantity: 1,
      unit: 'lump',
      unitPriceMin: 50000,
      unitPriceMax: 160000,
      lineMin: 50000,
      lineMax: 160000,
    });
  }

  return next;
}

const IMPROVEMENT_QUESTION_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'for',
  'in',
  'on',
  'at',
  'is',
  'are',
  'any',
  'what',
  'which',
  'how',
  'with',
  'from',
  'about',
  'exact',
  'additional',
  'requirements',
  'requirement',
  'required',
  'please',
  'need',
  'needed',
  'type',
  'types',
  'каковы',
  'какой',
  'какая',
  'какие',
  'есть',
  'ли',
  'для',
  'к',
  'и',
  'в',
  'на',
  'по',
  'с',
  'от',
  'из',
  'это',
  'эти',
  'нужно',
  'нужны',
  'требуется',
  'требуются',
  'точные',
  'точный',
  'дополнительные',
  'дополнительный',
  'требования',
  'требование',
  'тип',
  'типы',
]);

/**
 * Topic groups: a candidate is redundant if it and an answered question
 * both match every pattern in the same group (e.g. office finishing).
 * Space-qualified finishing is split so office ≠ warehouse.
 */
const IMPROVEMENT_TOPIC_GROUPS: RegExp[][] = [
  [/отделк|finish(?:ing)?|fit[- ]?out|interior\s*fit/i, /офис|office/i],
  [
    /отделк|finish(?:ing)?|fit[- ]?out|interior\s*fit/i,
    /склад|warehouse|storage|остальн/i,
  ],
  [
    /сантехн|plumbing|водоснаб|канализ|drainage|sewer|wet\s*point|сануз|bathroom|toilet/i,
  ],
  [
    /электр|electrical|освещен|lighting|wiring|socket|розет|проводк|fluorescent|светильник/i,
  ],
  [/hvac|вентил|кондиц|ventilation|air[- ]?cond|климат/i],
  [/пожарн|fire[- ]?suppress|sprinkler|fire[- ]?alarm/i],
  [/крыш|roof|кровл/i],
  [/пол|floor(?:ing)?|стяжк/i],
  [/фасад|facade|façade|exterior\s*wall/i],
];

const IMPROVEMENT_SPACE_MARKERS: Array<{ id: string; pattern: RegExp }> = [
  { id: 'office', pattern: /офис|office/i },
  { id: 'warehouse', pattern: /склад|warehouse|storage|остальн/i },
];

function improvementSpaceIds(question: string): string[] {
  return IMPROVEMENT_SPACE_MARKERS.filter((marker) =>
    marker.pattern.test(question),
  ).map((marker) => marker.id);
}

/** True when both questions name distinct spaces (office vs warehouse). */
function improvementQuestionsConflictOnSpace(a: string, b: string): boolean {
  const spacesA = improvementSpaceIds(a);
  const spacesB = improvementSpaceIds(b);
  if (spacesA.length === 0 || spacesB.length === 0) {
    return false;
  }
  return !spacesA.some((id) => spacesB.includes(id));
}

function stemImprovementToken(token: string): string {
  return token
    .replace(
      /(иями|ями|ами|иях|ях|ием|ем|ов|ев|ах|ям|ом|ой|ый|ий|ая|ое|ые|ие|ию|ью|ии|ыми|ими|ы|и|а|у|е|о|я|ю)$/u,
      '',
    )
    .replace(/(ings|ing|tions|tion|ments|ment|ies|ied|es|s)$/i, '');
}

function improvementQuestionTokens(question: string): Set<string> {
  const normalized = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = new Set<string>();
  for (const raw of normalized.split(' ')) {
    if (!raw || raw.length < 3 || IMPROVEMENT_QUESTION_STOPWORDS.has(raw)) {
      continue;
    }
    const stemmed = stemImprovementToken(raw);
    if (stemmed.length >= 3 && !IMPROVEMENT_QUESTION_STOPWORDS.has(stemmed)) {
      tokens.add(stemmed);
    }
  }
  return tokens;
}

function improvementTokenOverlap(
  a: Set<string>,
  b: Set<string>,
): { jaccard: number; recall: number } {
  if (a.size === 0 || b.size === 0) {
    return { jaccard: 0, recall: 0 };
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return {
    jaccard: union === 0 ? 0 : intersection / union,
    recall: intersection / Math.min(a.size, b.size),
  };
}

function matchesImprovementTopicGroup(
  question: string,
  patterns: RegExp[],
): boolean {
  return patterns.every((pattern) => pattern.test(question));
}

function sharesImprovementTopic(a: string, b: string): boolean {
  if (improvementQuestionsConflictOnSpace(a, b)) {
    return false;
  }
  return IMPROVEMENT_TOPIC_GROUPS.some(
    (patterns) =>
      matchesImprovementTopicGroup(a, patterns) &&
      matchesImprovementTopicGroup(b, patterns),
  );
}

/**
 * Drop improvement questions that repeat already-answered topics,
 * including paraphrases ("exact requirements", "additional…", etc.).
 */
export function filterImprovementQuestionsAgainstAnswers(
  candidates: string[],
  answeredQuestions: string[],
): string[] {
  if (candidates.length === 0) {
    return [];
  }

  const answeredExact = new Set(
    answeredQuestions
      .map((q) => q.trim().toLowerCase())
      .filter((q) => q.length > 0),
  );
  const answeredTokens = answeredQuestions
    .map((q) => ({ question: q, tokens: improvementQuestionTokens(q) }))
    .filter((row) => row.tokens.size > 0);

  const kept: string[] = [];
  const keptTokens: Array<Set<string>> = [];

  for (const raw of candidates) {
    const question = raw.trim();
    if (!question) continue;

    const lower = question.toLowerCase();
    if (answeredExact.has(lower)) continue;

    const tokens = improvementQuestionTokens(question);
    const overlapsAnswered = answeredTokens.some((row) => {
      if (improvementQuestionsConflictOnSpace(question, row.question)) {
        return false;
      }
      if (sharesImprovementTopic(question, row.question)) {
        return true;
      }
      const { jaccard, recall } = improvementTokenOverlap(tokens, row.tokens);
      return jaccard >= 0.45 || recall >= 0.75;
    });
    if (overlapsAnswered) continue;

    const overlapsKept = kept.some((prior, index) => {
      if (improvementQuestionsConflictOnSpace(question, prior)) {
        return false;
      }
      if (sharesImprovementTopic(question, prior)) {
        return true;
      }
      const { jaccard, recall } = improvementTokenOverlap(
        tokens,
        keptTokens[index]!,
      );
      return jaccard >= 0.45 || recall >= 0.75;
    });
    if (overlapsKept) continue;

    kept.push(question);
    keptTokens.push(tokens);
    answeredExact.add(lower);
  }

  return kept;
}
