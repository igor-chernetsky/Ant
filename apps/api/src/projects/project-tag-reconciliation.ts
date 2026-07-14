/**
 * Tag suggestions and AI tag reconciliation for projects.
 * Speculative tags (permits/design) must not exclude contractors by hallucination.
 * Pool and other amenity scopes must keep core craft trades, not collapse to design/demolition.
 */

const POOL_PATTERN =
  /\b(pool|swimming\s*pool|бассейн|สระว่ายน้ำ|สระน้ำ)\b/i;

const PERMIT_CONFIRMED_PATTERN =
  /\b((need|needs|require|requires|required|obtain|getting)\s+(a\s+)?(building\s+)?permit|permit\s+(is\s+)?required|разрешен\w*\s+(нужн|требу)|требуется\s+разрешен|нужно\s+разрешен|получить\s+разрешен)\b/i;

const PERMIT_DENIED_PATTERN =
  /\b((no|without|not)\s+(a\s+)?(building\s+)?permit|(permit|permits)\s+(not\s+required|unnecessary)|без\s+разрешен|разрешен\w*\s+не\s+(нужн|требу)|не\s+(нужно|требуется)\s+разрешен)\b/i;

const DESIGN_CONFIRMED_PATTERN =
  /\b(architect(\s+services)?|architectural\s+design|design\s+(tender|service|documentation|drawings|plans)|working\s+drawings|shop\s+drawings|needs?\s+design|проектн(ая|ые)\s+документац|рабоч(ие|их)\s+чертеж|чертеж\w*\s+(разрабатывает|готовит)\s+подрядчик|нужен\s+архитектор|architectural\s+plans)\b/i;

const DEMOLITION_CONFIRMED_PATTERN =
  /\b(demolition|strip[\s-]?out|dismantl|снос|демонтаж|разборк)\b/i;

const EXCAVATION_PATTERN =
  /\b(excavation|earthwork|digging|котлован|выемк|разработк\w*\s+грунт|земляны)\b/i;

const SPECULATIVE_TAGS = new Set(['permits', 'design']);

/** Typical craft coverage for a swimming-pool build (construction, not design-only). */
export const POOL_CORE_CRAFT_TAGS = [
  'structural',
  'plumbing',
  'electrical',
  'tiling',
] as const;

/** Keyword-based MVP suggestion — prefer confirmed craft trades over speculative ones. */
export function suggestTagSlugsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/\belectri|\bэлектро|\bосвещ|\bсвет(ов|ильник)?/, 'electrical'],
    [
      /\bplumb|\bpipe|\bwater heater|\bводопровод|\bсантех|\bводоснаб|\bканализ|\bfiltration|\bфильтр/,
      'plumbing',
    ],
    [/\broof|\bкровл|\bкрыш/, 'roofing'],
    [/\bfinish|\bотделк|\bpaint|\bfloor|\btile|\bплитк|\bмозаик/, 'finishing'],
    [DEMOLITION_CONFIRMED_PATTERN, 'demolition'],
    [
      /\bstruct|\bbeam|\bfoundation|\bстроительн|\bконструкц|\bфундамент|\bconcrete|\bбетон/,
      'structural',
    ],
    [/\bhvac|\bair cond|\bac\b|\bкондиц/, 'hvac'],
    [/\bpaint|\bпокраск|\bмаляр/, 'painting'],
    [/\bfloor|\bнапольн/, 'flooring'],
    [/\btile|\bплитк|\bкафель|\bмозаик/, 'tiling'],
    [/\bcarpent|\bwood|\bcabinet|\bстоляр|\bмебел/, 'carpentry'],
    [/\bgarden|\blandscape|\bзонт|\bumbrella|\bблагоустрой/, 'landscaping'],
    [/\bwindow|\bdoor|\bокон|\bдвер/, 'windows-doors'],
    [/\bconcrete|\bбетон/, 'concrete'],
    [/\bbrick|\bmason|\bкладк/, 'masonry'],
    [/\binsulat|\bутеплен/, 'insulation'],
  ];

  const slugs = new Set<string>();
  for (const [pattern, slug] of rules) {
    if (pattern.source.includes('EXCAVATION_PLACEHOLDER')) {
      continue;
    }
    if (pattern.test(lower)) {
      slugs.add(slug);
    }
  }

  if (EXCAVATION_PATTERN.test(text)) {
    slugs.add('structural');
  }

  if (POOL_PATTERN.test(text)) {
    for (const trade of POOL_CORE_CRAFT_TAGS) {
      slugs.add(trade);
    }
  }

  if (narrativeConfirmsDesign(text)) {
    slugs.add('design');
  }
  if (narrativeConfirmsPermits(text)) {
    slugs.add('permits');
  }

  // Excavation/earthworks for a new pool is structural work, not demolition.
  if (
    slugs.has('demolition') &&
    POOL_PATTERN.test(text) &&
    !DEMOLITION_CONFIRMED_PATTERN.test(text)
  ) {
    slugs.delete('demolition');
    slugs.add('structural');
  }

  return [...slugs];
}

export function narrativeConfirmsPermits(text: string): boolean {
  if (!text.trim()) return false;
  if (PERMIT_DENIED_PATTERN.test(text)) return false;
  return PERMIT_CONFIRMED_PATTERN.test(text);
}

export function narrativeConfirmsDesign(text: string): boolean {
  if (!text.trim()) return false;
  return DESIGN_CONFIRMED_PATTERN.test(text);
}

export function narrativeDeniesPermits(text: string): boolean {
  return PERMIT_DENIED_PATTERN.test(text);
}

export function narrativeConfirmsDemolition(text: string): boolean {
  return DEMOLITION_CONFIRMED_PATTERN.test(text);
}

export function isPoolFocusedNarrative(text: string): boolean {
  return POOL_PATTERN.test(text);
}

/**
 * Merge AI-suggested tags with still-relevant previous trades.
 * Strips speculative permits/design unless the narrative explicitly confirms them.
 * Ensures pool builds keep core craft trades even when the latest answer was about drawings.
 */
export function reconcileAiTagSlugs(input: {
  suggested: string[];
  previous?: string[];
  narrative: string;
  preserveTrades?: string[];
  allowed?: string[];
}): string[] {
  const allowed = input.allowed ? new Set(input.allowed) : null;
  const narrative = input.narrative;
  const deniedPermits = narrativeDeniesPermits(narrative);
  const confirmsPermits = narrativeConfirmsPermits(narrative);
  const confirmsDesign = narrativeConfirmsDesign(narrative);
  const confirmsDemolition = narrativeConfirmsDemolition(narrative);
  const poolFocused = isPoolFocusedNarrative(narrative);

  const merged = new Set<string>();

  for (const slug of [
    ...(input.previous ?? []),
    ...(input.preserveTrades ?? []),
    ...input.suggested,
  ]) {
    if (!slug) continue;
    if (allowed && !allowed.has(slug)) continue;

    if (slug === 'permits') {
      if (deniedPermits || !confirmsPermits) continue;
    }
    if (slug === 'design') {
      if (!confirmsDesign) continue;
    }
    if (slug === 'demolition') {
      if (poolFocused && !confirmsDemolition) continue;
    }

    merged.add(slug);
  }

  for (const trade of input.preserveTrades ?? []) {
    if (allowed && !allowed.has(trade)) continue;
    if (SPECULATIVE_TAGS.has(trade)) continue;
    if (trade === 'demolition' && poolFocused && !confirmsDemolition) continue;
    merged.add(trade);
  }

  const fromText = suggestTagSlugsFromText(narrative);
  for (const slug of fromText) {
    if (allowed && !allowed.has(slug)) continue;
    if (slug === 'permits' && (deniedPermits || !confirmsPermits)) continue;
    if (slug === 'design' && !confirmsDesign) continue;
    if (slug === 'demolition' && poolFocused && !confirmsDemolition) continue;
    merged.add(slug);
  }

  if (poolFocused) {
    for (const trade of POOL_CORE_CRAFT_TAGS) {
      if (allowed && !allowed.has(trade)) continue;
      merged.add(trade);
    }
  }

  if (confirmsDesign) {
    if (!allowed || allowed.has('design')) {
      merged.add('design');
    }
  }

  return [...merged];
}

export const TAG_NO_HALLUCINATION_RULES = `Tag and description honesty rules:
- Do NOT invent permit, license, approval, or compliance requirements. Only mention them if the client or documents stated them.
- If permits are uncertain, ask a question or omit — never assert that a permit is required.
- Do NOT add tag "permits" unless the client confirmed permits/approvals are needed.
- Tag "design" is appropriate when the client says the contractor prepares working/shop drawings, but that must be ADDITIVE — still keep construction trades.
- For swimming-pool construction, tagSlugs MUST include structural, plumbing, electrical, and tiling (plus design only if drawings are in contractor scope). Do not leave only demolition and/or design.
- Do not treat pool excavation / earthworks as demolition unless real strip-out or demolition is stated.
- tagSlugs must reflect real construction trades in scope. Prefer omitting a speculative tag over guessing.
- When revising tags after clarifications, keep still-relevant craft trades; do not replace the whole list with only the newest answer topic (e.g. drawings).`;
