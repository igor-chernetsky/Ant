import type {
  BidAnalysisBidInput,
  BidAnalysisContext,
  BidAnalysisResult,
} from './bid-analysis.types';

/** Prompt block: evaluate every bid from the employer / client perspective only. */
export function employerBidAnalysisPromptRules(): string {
  return `AUDIENCE (mandatory): You advise the EMPLOYER / CLIENT (the project owner), NOT contractors.
Never praise terms because they are favourable to the contractor. Flip the logic:

Contract & payment terms — employer perspective:
- Advance payment: LOWER % or amount is BETTER for the employer (less upfront exposure). Higher advance = WEAKNESS or RISK for the employer.
- Delay damages / liquidated damages: HIGHER daily rate (e.g. 0.3%/day vs 0.1%/day) is BETTER for the employer (stronger protection). Lower penalty = WEAKER protection for the employer — say so explicitly.
- Retention: HIGHER retention % is generally BETTER for the employer (more holdback until completion).
- Warranty / defect notification period: LONGER is BETTER for the employer. Never call a longer period a weakness.
- Shorter timeline and earlier works start are strengths for the employer when price and other commercial terms are comparable.
- When two or more bids have the same (or nearly the same) price AND comparable advance / retention / warranty / delay damages, you MUST use timeline as the decisive factor: prefer earlier worksStartDate, then shorter durationDays / earlier worksFinishDate. Do not return recommendedBidId=null solely because price and contract terms match if timeline differs.
- Timeline vs price (numeric rule, mandatory): a shorter duration justifies a HIGHER price ONLY when the duration reduction in % is LARGER than the price premium in % AND payment/warranty terms are not worse. If the price premium (in %) exceeds the duration saving (in %), recommend the CHEAPER bid — a shorter schedule alone must not win. Example: +30% price for a 1-day gain on a ~40-day schedule (~2.5%) is NOT a justification; never recommend the pricier bid in that case.
- Flag missing worksStartDate / worksFinishDate / durationDays as employer risk when other bids provide them.

- Do NOT restate numeric rankings and do NOT name a winner in the summary or reasoning text.
  The platform appends the verified rankings and the final verdict verbatim, so any
  second opinion in your prose can contradict them. Use your prose for scope
  coverage, missing or vague items, quality concerns and employer risks only.
- When a term is marked EQUAL in employerComparisonFacts, never present it as an
  advantage or a disadvantage for either bid — say the term is equal or omit it.

When comparing two bids on the same term, always explain why it helps or hurts the EMPLOYER.
Do NOT write "reduces financial risk" for terms that mainly protect the contractor (low advance, low penalties).

Price & scope:
- Lower total price is usually better for the employer IF scope coverage is comparable.
- Flag under-scoped or vague bids as employer risk even when cheap.

Use the employerComparisonFacts block verbatim for numeric rankings — never invert which bid is higher/lower on price, advance, or warranty length.
Write strengths/weaknesses/riskFlags from the employer's point of view only.`;
}

export function bidLabel(bid: BidAnalysisBidInput): string {
  return bid.companyName?.trim() || `Bid ${bid.id.slice(0, 8)}`;
}

function formatThb(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} THB`;
}

function parseWorksIsoDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return iso?.[1] ?? null;
}

function bidDurationDays(bid: BidAnalysisBidInput): number | null {
  if (bid.durationDays != null && bid.durationDays >= 1) {
    return bid.durationDays;
  }
  const start = parseWorksIsoDate(bid.terms?.contractTerms?.worksStartDate);
  const finish = parseWorksIsoDate(bid.terms?.contractTerms?.worksFinishDate);
  if (!start || !finish) return null;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const finishMs = Date.parse(`${finish}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(finishMs) || finishMs < startMs) {
    return null;
  }
  return Math.round((finishMs - startMs) / 86_400_000);
}

/** Lower score is better for the employer when commercial terms are tied. */
function timelineScore(bid: BidAnalysisBidInput): number | null {
  const start = parseWorksIsoDate(bid.terms?.contractTerms?.worksStartDate);
  const duration = bidDurationDays(bid);
  if (start == null && duration == null) return null;
  const startRank = start
    ? Date.parse(`${start}T00:00:00Z`)
    : Number.POSITIVE_INFINITY;
  const durationRank = duration ?? Number.POSITIVE_INFINITY;
  // Prefer earlier start, then shorter duration.
  return startRank / 1_000_000 + durationRank;
}

function amountsAreTied(
  a: number,
  b: number,
  epsilonThb = 1,
): boolean {
  return Math.abs(a - b) <= epsilonThb;
}

function commercialTermsComparable(
  a: BidAnalysisBidInput,
  b: BidAnalysisBidInput,
): boolean {
  const advanceA = effectiveAdvancePercent(a);
  const advanceB = effectiveAdvancePercent(b);
  if (
    advanceA != null &&
    advanceB != null &&
    Math.abs(advanceA - advanceB) > 0.05
  ) {
    return false;
  }

  const warrantyA = a.terms?.contractTerms?.defectNotificationMonths;
  const warrantyB = b.terms?.contractTerms?.defectNotificationMonths;
  if (
    warrantyA != null &&
    warrantyB != null &&
    warrantyA !== warrantyB
  ) {
    return false;
  }

  const retentionA = a.terms?.contractTerms?.retentionPercent;
  const retentionB = b.terms?.contractTerms?.retentionPercent;
  if (
    retentionA != null &&
    retentionB != null &&
    Math.abs(retentionA - retentionB) > 0.05
  ) {
    return false;
  }

  const penaltyA = parseDailyPenaltyPercent(
    a.terms?.contractTerms?.delayDamagesNotes,
  );
  const penaltyB = parseDailyPenaltyPercent(
    b.terms?.contractTerms?.delayDamagesNotes,
  );
  if (
    penaltyA != null &&
    penaltyB != null &&
    Math.abs(penaltyA - penaltyB) > 0.001
  ) {
    return false;
  }

  return true;
}

/** Cheapest bid by total amount (the natural alternative to a pricier pick). */
export function cheapestBid(
  bids: BidAnalysisBidInput[],
): BidAnalysisBidInput | null {
  if (bids.length === 0) return null;
  return [...bids].sort((a, b) => Number(a.amount) - Number(b.amount))[0]!;
}

/** How much more expensive `bid` is compared to `base`, in percent. */
export function pricePremiumPercent(
  bid: BidAnalysisBidInput,
  base: BidAnalysisBidInput,
): number {
  const baseAmount = Number(base.amount);
  const amount = Number(bid.amount);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0 || !Number.isFinite(amount)) {
    return 0;
  }
  return ((amount - baseAmount) / baseAmount) * 100;
}

/** How much shorter `bid` is compared to `base`, in percent of the base duration. */
export function durationGainPercent(
  bid: BidAnalysisBidInput,
  base: BidAnalysisBidInput,
): number {
  const baseDays = bidDurationDays(base);
  const days = bidDurationDays(bid);
  if (baseDays == null || days == null || baseDays <= 0) return 0;
  return ((baseDays - days) / baseDays) * 100;
}

/** Does `bid` offer materially better payment / warranty terms than `other`? */
export function hasBetterEmployerTerms(
  bid: BidAnalysisBidInput,
  other: BidAnalysisBidInput,
): boolean {
  const advance = effectiveAdvancePercent(bid);
  const otherAdvance = effectiveAdvancePercent(other);
  if (advance != null && otherAdvance != null && advance < otherAdvance - 0.05) {
    return true;
  }

  const warranty = bid.terms?.contractTerms?.defectNotificationMonths;
  const otherWarranty = other.terms?.contractTerms?.defectNotificationMonths;
  if (warranty != null && otherWarranty != null && warranty > otherWarranty) {
    return true;
  }

  const retention = bid.terms?.contractTerms?.retentionPercent;
  const otherRetention = other.terms?.contractTerms?.retentionPercent;
  if (
    retention != null &&
    otherRetention != null &&
    retention > otherRetention + 0.05
  ) {
    return true;
  }

  const penalty = parseDailyPenaltyPercent(
    bid.terms?.contractTerms?.delayDamagesNotes,
  );
  const otherPenalty = parseDailyPenaltyPercent(
    other.terms?.contractTerms?.delayDamagesNotes,
  );
  if (penalty != null && otherPenalty != null && penalty > otherPenalty + 0.001) {
    return true;
  }

  return false;
}

/**
 * Employer rule: a shorter duration justifies a higher price ONLY when the
 * duration saving (in %) is LARGER than the price premium (in %) and the
 * pricier bid is not worse on payment / warranty terms.
 *
 * e.g. +30% price for a 1-day gain on a 40-day schedule (~2.5%) is NOT justified.
 */
export function timelinePremiumUnjustified(
  bid: BidAnalysisBidInput,
  base: BidAnalysisBidInput,
): boolean {
  if (bid.id === base.id) return false;

  const premium = pricePremiumPercent(bid, base);
  if (premium <= 0) return false;

  if (hasBetterEmployerTerms(bid, base)) return false;

  const gain = durationGainPercent(bid, base);
  if (gain <= 0) return true;
  return premium > gain;
}

/**
 * When price and commercial terms are tied, pick the bid with the best
 * timeline (earlier start, then shorter duration).
 */
export function pickTimelineTiebreaker(
  bids: BidAnalysisBidInput[],
): BidAnalysisBidInput | null {
  if (bids.length < 2) return null;

  const amounts = bids.map((bid) => Number(bid.amount));
  const minAmount = Math.min(...amounts);
  const priceTied = bids.filter((bid) =>
    amountsAreTied(Number(bid.amount), minAmount),
  );
  if (priceTied.length < 2) return null;

  for (let i = 0; i < priceTied.length; i += 1) {
    for (let j = i + 1; j < priceTied.length; j += 1) {
      if (!commercialTermsComparable(priceTied[i]!, priceTied[j]!)) {
        return null;
      }
    }
  }

  const scored = priceTied
    .map((bid) => ({ bid, score: timelineScore(bid) }))
    .filter(
      (row): row is { bid: BidAnalysisBidInput; score: number } =>
        row.score != null,
    )
    .sort((a, b) => a.score - b.score);

  if (scored.length < 2) return null;
  if (scored[0]!.score >= scored[1]!.score) return null;
  return scored[0]!.bid;
}

const NUMERIC_TERM_BULLET_RE =
  /\b(price|cost|amount|advance|payment|upfront|warranty|defect|notification|retention|penalty|damages|thb|฿|months?|days?|timeline|schedule|duration|start|finish|earlier|later|shorter|longer|higher|lower|cheaper|expensive|дорог|дешев|аванс|гарант|срок|нача|оконч)\b/i;

export function isNumericTermBullet(text: string): boolean {
  return NUMERIC_TERM_BULLET_RE.test(text);
}

/**
 * Append one ranked block to the facts.
 *
 * When every bid shares the same value the block says so explicitly. Printing a
 * ranked list instead used to label the first row "best" and the last "worst"
 * even when all values were identical, which invited the model to present a
 * difference that does not exist.
 */
function appendRankingBlock<T extends string | number>(params: {
  lines: string[];
  title: string;
  rows: Array<{ bid: BidAnalysisBidInput; value: T }>;
  compare: (a: T, b: T) => number;
  formatValue: (value: T) => string;
  bestSuffix: string;
  worstSuffix: string;
}): void {
  const { lines, title, rows, compare, formatValue, bestSuffix, worstSuffix } =
    params;
  if (rows.length < 2) {
    return;
  }

  const sorted = [...rows].sort((a, b) => compare(a.value, b.value));
  const best = sorted[0]!;
  const worst = sorted[sorted.length - 1]!;

  lines.push(title);
  if (compare(best.value, worst.value) === 0) {
    lines.push(
      `  EQUAL for all bids: ${formatValue(best.value)} — no advantage either way for the employer.`,
    );
    return;
  }

  sorted.forEach((row, index) => {
    const marker =
      index === 0 ? bestSuffix : index === sorted.length - 1 ? worstSuffix : '';
    lines.push(`  ${bidLabel(row.bid)}: ${formatValue(row.value)}${marker}`);
  });
}

export function buildEmployerComparisonFacts(context: BidAnalysisContext): string {
  const { bids } = context;
  if (bids.length < 2) {
    return '';
  }

  const lines: string[] = [
    'VERIFIED NUMERIC RANKINGS (binding — do not invert these comparisons):',
  ];

  appendRankingBlock({
    lines,
    title: 'Total price — LOWER is BETTER for the employer:',
    rows: bids.map((bid) => ({ bid, value: Number(bid.amount) })),
    compare: (a, b) => a - b,
    formatValue: formatThb,
    bestSuffix: ' ← LOWEST (best for employer)',
    worstSuffix: ' ← HIGHEST',
  });

  appendRankingBlock({
    lines,
    title: 'Advance payment — LOWER % is BETTER for the employer:',
    rows: bids
      .map((bid) => ({ bid, value: effectiveAdvancePercent(bid) }))
      .filter(
        (row): row is { bid: BidAnalysisBidInput; value: number } =>
          row.value != null,
      ),
    compare: (a, b) => a - b,
    formatValue: (value) => `${value.toFixed(1)}%`,
    bestSuffix: ' ← LOWEST (best for employer)',
    worstSuffix: ' ← HIGHEST (worst for employer)',
  });

  appendRankingBlock({
    lines,
    title: 'Defect notification / warranty — LONGER is BETTER for the employer:',
    rows: bids
      .map((bid) => ({
        bid,
        value: bid.terms?.contractTerms?.defectNotificationMonths ?? null,
      }))
      .filter(
        (row): row is { bid: BidAnalysisBidInput; value: number } =>
          row.value != null,
      ),
    compare: (a, b) => a - b,
    formatValue: (value) => `${value} months`,
    bestSuffix: ' ← SHORTEST (worst for employer)',
    worstSuffix: ' ← LONGEST (best for employer)',
  });

  appendRankingBlock({
    lines,
    title:
      'Works start date — EARLIER is BETTER for the employer when price/terms are comparable:',
    rows: bids
      .map((bid) => ({
        bid,
        value: parseWorksIsoDate(bid.terms?.contractTerms?.worksStartDate),
      }))
      .filter(
        (row): row is { bid: BidAnalysisBidInput; value: string } =>
          row.value != null,
      ),
    compare: (a, b) => a.localeCompare(b),
    formatValue: (value) => value,
    bestSuffix: ' ← EARLIEST (best for employer)',
    worstSuffix: ' ← LATEST',
  });

  appendRankingBlock({
    lines,
    title:
      'Works duration — SHORTER is BETTER for the employer when price/terms are comparable:',
    rows: bids
      .map((bid) => ({ bid, value: bidDurationDays(bid) }))
      .filter(
        (row): row is { bid: BidAnalysisBidInput; value: number } =>
          row.value != null,
      ),
    compare: (a, b) => a - b,
    formatValue: (value) => `${value} days`,
    bestSuffix: ' ← SHORTEST (best for employer)',
    worstSuffix: ' ← LONGEST',
  });

  appendRankingBlock({
    lines,
    title:
      'Works finish date — EARLIER is BETTER for the employer when price/terms are comparable:',
    rows: bids
      .map((bid) => ({
        bid,
        value: parseWorksIsoDate(bid.terms?.contractTerms?.worksFinishDate),
      }))
      .filter(
        (row): row is { bid: BidAnalysisBidInput; value: string } =>
          row.value != null,
      ),
    compare: (a, b) => a.localeCompare(b),
    formatValue: (value) => value,
    bestSuffix: ' ← EARLIEST finish (best for employer)',
    worstSuffix: ' ← LATEST finish',
  });

  const cheapest = cheapestBid(bids);
  if (cheapest) {
    const premiumRows = bids
      .filter((bid) => bid.id !== cheapest.id)
      .map((bid) => ({
        bid,
        premium: pricePremiumPercent(bid, cheapest),
        gain: durationGainPercent(bid, cheapest),
        justified: !timelinePremiumUnjustified(bid, cheapest),
      }));
    if (premiumRows.length > 0) {
      lines.push(
        `VALUE RULE — a shorter duration justifies a higher price ONLY when the duration saving (in %) is LARGER than the price premium (in %); otherwise the cheaper bid ${bidLabel(cheapest)} wins:`,
      );
      for (const row of premiumRows) {
        lines.push(
          `  ${bidLabel(row.bid)}: +${row.premium.toFixed(1)}% price vs ${bidLabel(cheapest)}, ${row.gain.toFixed(1)}% shorter duration${
            row.justified
              ? ' ← timeline may justify the premium'
              : ' ← NOT justified by the timeline alone'
          }`,
        );
      }
    }
  }

  const timelineWinner = pickTimelineTiebreaker(bids);
  if (timelineWinner) {
    lines.push(
      `TIE-BREAKER: price and commercial terms are comparable — recommend ${bidLabel(timelineWinner)} for the better works schedule (earlier start / shorter duration).`,
    );
  }

  return lines.join('\n');
}

export function buildEmployerFactualNarrative(context: BidAnalysisContext): string {
  const { bids } = context;
  if (bids.length < 2) {
    return '';
  }

  const parts: string[] = [];

  const byPrice = [...bids].sort(
    (a, b) => Number(a.amount) - Number(b.amount),
  );
  const cheapest = byPrice[0];
  const priciest = byPrice[byPrice.length - 1];
  if (Number(cheapest.amount) < Number(priciest.amount)) {
    parts.push(
      `${bidLabel(cheapest)} is lowest at ${formatThb(Number(cheapest.amount))}; ${bidLabel(priciest)} is highest at ${formatThb(Number(priciest.amount))}`,
    );
  }

  const advanceRows = bids
    .map((bid) => ({ bid, advance: effectiveAdvancePercent(bid) }))
    .filter((row): row is { bid: BidAnalysisBidInput; advance: number } =>
      row.advance != null,
    )
    .sort((a, b) => a.advance - b.advance);
  if (
    advanceRows.length >= 2 &&
    advanceRows[0].advance < advanceRows[advanceRows.length - 1].advance
  ) {
    const low = advanceRows[0];
    const high = advanceRows[advanceRows.length - 1];
    parts.push(
      `${bidLabel(low.bid)} has the lowest advance (${low.advance.toFixed(1)}%); ${bidLabel(high.bid)} requires the highest (${high.advance.toFixed(1)}%)`,
    );
  }

  const warrantyRows = bids
    .map((bid) => ({
      bid,
      months: bid.terms?.contractTerms?.defectNotificationMonths ?? null,
    }))
    .filter(
      (row): row is { bid: BidAnalysisBidInput; months: number } =>
        row.months != null,
    )
    .sort((a, b) => a.months - b.months);
  if (
    warrantyRows.length >= 2 &&
    warrantyRows[0].months < warrantyRows[warrantyRows.length - 1].months
  ) {
    const short = warrantyRows[0];
    const long = warrantyRows[warrantyRows.length - 1];
    parts.push(
      `${bidLabel(long.bid)} offers the longest defect notification (${long.months} months vs ${short.months} for ${bidLabel(short.bid)})`,
    );
  }

  const startRows = bids
    .map((bid) => ({
      bid,
      start: parseWorksIsoDate(bid.terms?.contractTerms?.worksStartDate),
    }))
    .filter(
      (row): row is { bid: BidAnalysisBidInput; start: string } =>
        row.start != null,
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  if (
    startRows.length >= 2 &&
    startRows[0]!.start < startRows[startRows.length - 1]!.start
  ) {
    const earliest = startRows[0]!;
    const latest = startRows[startRows.length - 1]!;
    parts.push(
      `${bidLabel(earliest.bid)} starts earlier (${earliest.start} vs ${latest.start} for ${bidLabel(latest.bid)})`,
    );
  }

  const durationRows = bids
    .map((bid) => ({ bid, days: bidDurationDays(bid) }))
    .filter(
      (row): row is { bid: BidAnalysisBidInput; days: number } =>
        row.days != null,
    )
    .sort((a, b) => a.days - b.days);
  if (
    durationRows.length >= 2 &&
    durationRows[0]!.days < durationRows[durationRows.length - 1]!.days
  ) {
    const shortest = durationRows[0]!;
    const longest = durationRows[durationRows.length - 1]!;
    parts.push(
      `${bidLabel(shortest.bid)} offers the shorter duration (${shortest.days} days vs ${longest.days} for ${bidLabel(longest.bid)})`,
    );
  }

  return parts.length > 0 ? `${parts.join('. ')}.` : '';
}

function mentionsBid(
  sentence: string,
  bid: BidAnalysisBidInput,
): boolean {
  const labels = [bidLabel(bid), bid.companyName?.trim()].filter(
    Boolean,
  ) as string[];
  return labels.some((label) => {
    const normalized = label.toLowerCase();
    return (
      sentence.toLowerCase().includes(normalized) ||
      sentence.toLowerCase().includes(normalized.replace(/\s+/g, ''))
    );
  });
}

function sentenceContradictsEmployerFacts(
  sentence: string,
  context: BidAnalysisContext,
): boolean {
  for (const bid of context.bids) {
    if (!mentionsBid(sentence, bid)) {
      continue;
    }

    const amount = Number(bid.amount);
    const amounts = context.bids.map((item) => Number(item.amount));
    const isLowest =
      amounts.length > 1 && amount === Math.min(...amounts);
    const isHighest =
      amounts.length > 1 && amount === Math.max(...amounts);

    if (
      isLowest &&
      /\b(higher|more expensive|costs more|above|дороже|выше)\b/i.test(sentence) &&
      /\b(price|bid|cost|amount|thb|฿|цен)\b/i.test(sentence)
    ) {
      return true;
    }
    if (
      isHighest &&
      /\b(lower|cheaper|less expensive|below|дешевле|ниже)\b/i.test(sentence) &&
      /\b(price|bid|cost|amount|thb|฿|цен)\b/i.test(sentence)
    ) {
      return true;
    }

    const advance = effectiveAdvancePercent(bid);
    const advances = context.bids
      .map((item) => effectiveAdvancePercent(item))
      .filter((value): value is number => value != null);
    if (advance != null && advances.length > 1) {
      const isLowestAdvance = advance === Math.min(...advances);
      const isHighestAdvance = advance === Math.max(...advances);
      if (
        isLowestAdvance &&
        /\b(higher advance|more advance|high advance|больш(ий|е) аванс)\b/i.test(
          sentence,
        )
      ) {
        return true;
      }
      if (
        isHighestAdvance &&
        /\b(lower advance|less advance|low advance|меньш(ий|е) аванс)\b/i.test(
          sentence,
        )
      ) {
        return true;
      }
    }

    const warranty = bid.terms?.contractTerms?.defectNotificationMonths;
    const warranties = context.bids
      .map((item) => item.terms?.contractTerms?.defectNotificationMonths)
      .filter((value): value is number => value != null);
    if (warranty != null && warranties.length > 1) {
      const isLongest = warranty === Math.max(...warranties);
      const isShortest = warranty === Math.min(...warranties);
      const warrantyContext =
        /\b(warranty|defect|notification|гарант|months?)\b/i.test(sentence);
      if (!warrantyContext) {
        continue;
      }
      if (
        isLongest &&
        /\b(shorter|less|only\s+\d+|weak|worse|хуже|меньше|lower)\b/i.test(
          sentence,
        )
      ) {
        return true;
      }
      if (
        isShortest &&
        /\b(longer|more|better|stronger|лучше|дольше|higher)\b/i.test(sentence)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Deterministic verdict text for the FINAL recommendation.
 *
 * The narrative shown to the employer must never contradict the decision, so the
 * summary is written by the platform from the same facts the decision was based
 * on — the model only discusses scope, coverage and quality risks.
 */
export function buildEmployerVerdict(
  context: BidAnalysisContext,
  recommendedBidId: string | null,
): string {
  const winner = recommendedBidId
    ? (context.bids.find((bid) => bid.id === recommendedBidId) ?? null)
    : null;
  if (!winner) {
    return 'No bid could be recommended from the submitted data — review scope coverage and the flagged risks before choosing.';
  }

  const amount = Number(winner.amount);
  const cheapest = cheapestBid(context.bids);
  const isCheapest =
    cheapest == null || amountsAreTied(amount, Number(cheapest.amount));
  if (isCheapest) {
    // Explain the rejected alternative so the shorter schedule noted in the facts
    // does not look like an oversight.
    const faster = context.bids
      .filter((bid) => bid.id !== winner.id)
      .map((bid) => ({
        bid,
        gain: durationGainPercent(bid, winner),
        premium: pricePremiumPercent(bid, winner),
      }))
      .filter(
        (row) => row.gain > 0 && timelinePremiumUnjustified(row.bid, winner),
      )
      .sort((a, b) => b.gain - a.gain)[0];
    const clause = faster
      ? ` ${bidLabel(faster.bid)} is ${faster.gain.toFixed(1)}% faster but costs ${faster.premium.toFixed(1)}% more, which the shorter schedule alone does not justify.`
      : '';
    return `${bidLabel(winner)} is the lowest-priced bid at ${formatThb(amount)} and is recommended.${clause}`;
  }

  const premium = pricePremiumPercent(winner, cheapest);
  const gain = durationGainPercent(winner, cheapest);
  const betterTerms = hasBetterEmployerTerms(winner, cheapest);
  const reason = betterTerms
    ? 'its payment/warranty terms are better for the employer'
    : gain > premium
      ? `it saves ${gain.toFixed(1)}% of the works duration against a ${premium.toFixed(1)}% price premium`
      : 'the balance of price, schedule and contract terms is better overall';

  return `${bidLabel(winner)} is recommended at ${formatThb(amount)}, ${premium.toFixed(1)}% above the cheapest bid ${bidLabel(cheapest)}, because ${reason}.`;
}

// `\b` is ASCII-only, so Russian/Thai alternatives are matched without it.
const RANKED_ATTRIBUTE_PATTERNS = [
  /\b(price|cost|amount|thb|฿|advance|payment|upfront|retention|holdback|warranty|defect|notification|penalt|liquidated|damages|timeline|schedule|duration|days?|months?|start|finish|completion|earlier|later|faster|slower|shorter|longer|cheaper|expensive|lowest|highest|best|worst)\b/i,
  /(цена|стоимост|аванс|гарант|срок|удержан|неустойк|дороже|дешевле|быстрее|медленнее|длительн)/i,
  /(ราคา|เงินล่วงหน้า|ระยะเวลา|ประกัน|สัญญา)/,
];

const RECOMMENDATION_PATTERNS = [
  /\b(recommend|recommended|recommendation|should (choose|select|pick)|best (choice|option|value)|preferred|winner|award (them|it)|go with)\b/i,
  /(выбира|рекоменд|лучш(ий|его) вариант)/i,
  /(แนะนำ|เลือก)/,
];

const COMPARISON_PATTERNS = [
  /\b(better|worse|superior|inferior|advantage|disadvantage|more|less|fewer|lower|higher|greater|stronger|weaker|versus|vs\.?)\b/i,
  /(лучше|хуже|больше|меньше|выгодн)/i,
  /(ดีกว่า|แย่กว่า|มากกว่า|น้อยกว่า)/,
];

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Keep only sentences that discuss scope, coverage, quality or employer risks —
 * i.e. what the model is genuinely better at than the platform rules.
 *
 * Anything that ranks bids or names a winner is dropped: the platform appends the
 * verified rankings and the verdict, and a second, unverifiable opinion next to
 * them is what produced self-contradicting analyses.
 */
export function filterEmployerScopeProse(
  text: string,
  context: BidAnalysisContext,
): string {
  if (!text?.trim()) {
    return '';
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const kept = sentences.filter((sentence) => {
    const trimmed = sentence.trim();
    if (!trimmed) return false;
    if (sentenceContradictsEmployerFacts(trimmed, context)) return false;
    if (matchesAnyPattern(trimmed, RECOMMENDATION_PATTERNS)) return false;

    const mentionsAnyBid = context.bids.some((bid) =>
      mentionsBid(trimmed, bid),
    );
    const mentionsRankedTerm = matchesAnyPattern(trimmed, RANKED_ATTRIBUTE_PATTERNS);
    const compares = matchesAnyPattern(trimmed, COMPARISON_PATTERNS);

    // A sentence about a specific bid that also touches a ranked attribute or
    // compares bids is a ranking claim, not a scope observation.
    if (mentionsAnyBid && mentionsRankedTerm) return false;
    if (mentionsAnyBid && compares) return false;
    if (mentionsRankedTerm && compares) return false;
    return true;
  });

  return kept.join(' ').trim();
}

/** Compose the final narrative: verified facts, the verdict, then scope prose. */
export function buildEmployerNarrative(params: {
  facts: string;
  verdict: string;
  scopeProse: string;
  separator?: string;
}): string {
  return [params.facts, params.verdict, params.scopeProse]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(params.separator ?? ' ');
}

export function buildDeterministicEmployerComparison(
  bid: BidAnalysisBidInput,
  allBids: BidAnalysisBidInput[],
): { strengths: string[]; weaknesses: string[]; riskFlags: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const riskFlags: string[] = [];

  const amount = Number(bid.amount);
  const amounts = allBids.map((item) => Number(item.amount));
  if (allBids.length > 1) {
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    if (amount === minAmount && minAmount < maxAmount) {
      strengths.push(`Lowest price: ${formatThb(amount)}`);
    } else if (amount === maxAmount && maxAmount > minAmount) {
      const deltaPct = Math.round(((amount - minAmount) / minAmount) * 100);
      weaknesses.push(
        `Highest price: ${formatThb(amount)} (+${deltaPct}% vs lowest)`,
      );
    }
  }

  const termNotes = employerContractTermNotes(bid, allBids);
  strengths.push(...termNotes.strengths);
  weaknesses.push(...termNotes.weaknesses);
  riskFlags.push(...termNotes.riskFlags);

  return { strengths, weaknesses, riskFlags };
}

/**
 * Merge the model's comparison with the verified numbers.
 *
 * The recommendation is resolved first (model pick, corrected by the timeline
 * tie-breaker and the price/timeline value rule); the narrative is then written
 * from that decision, so the text cannot argue for a different winner.
 */
export function enforceEmployerBidAnalysis(
  result: BidAnalysisResult,
  context: BidAnalysisContext,
): BidAnalysisResult {
  const { recommendedBidId, recommendedCompanyName } =
    resolveEmployerRecommendation(result, context);
  const winner = recommendedBidId
    ? (context.bids.find((bid) => bid.id === recommendedBidId) ?? null)
    : null;

  const facts = buildEmployerFactualNarrative(context);
  const verdict = buildEmployerVerdict(context, recommendedBidId);
  const scopeProse = filterEmployerScopeProse(result.reasoning, context);

  // The panel renders the summary above the reasoning, so the summary is the
  // verdict only and the reasoning carries the verified facts it is based on.
  const summary = verdict || facts;
  const reasoning = buildEmployerNarrative({
    facts,
    verdict,
    scopeProse,
    separator: '\n\n',
  });

  const comparisons = context.bids.map((bid) => {
    const ai = result.comparisons.find((item) => item.bidId === bid.id);
    const deterministic = buildDeterministicEmployerComparison(
      bid,
      context.bids,
    );

    return {
      bidId: bid.id,
      companyName: bid.companyName,
      strengths: [
        ...deterministic.strengths,
        ...(ai?.strengths ?? []).filter((item) => !isNumericTermBullet(item)),
      ],
      weaknesses: [
        ...deterministic.weaknesses,
        ...(ai?.weaknesses ?? []).filter((item) => !isNumericTermBullet(item)),
      ],
      riskFlags: [
        ...new Set([
          ...deterministic.riskFlags,
          ...(ai?.riskFlags ?? []).filter((item) => !isNumericTermBullet(item)),
        ]),
      ],
    };
  });

  return {
    ...result,
    recommendedBidId,
    recommendedCompanyName: recommendedCompanyName ?? winner?.companyName ?? null,
    summary,
    reasoning,
    comparisons,
    confidence: winner ? Math.max(result.confidence, 0.55) : result.confidence,
  };
}

/**
 * Final employer recommendation.
 *
 * Starts from the model's pick (it is the only signal about scope coverage) and
 * corrects it with two deterministic rules:
 *  - equal price and comparable terms → the better works schedule wins;
 *  - a price premium larger than the duration saving, with no better terms → the
 *    cheaper bid wins.
 */
export function resolveEmployerRecommendation(
  result: BidAnalysisResult,
  context: BidAnalysisContext,
): { recommendedBidId: string | null; recommendedCompanyName: string | null } {
  const cheapest = cheapestBid(context.bids);
  let recommendedBidId = result.recommendedBidId;
  let recommendedCompanyName = result.recommendedCompanyName;

  const timelineWinner = pickTimelineTiebreaker(context.bids);
  if (
    timelineWinner &&
    (recommendedBidId == null || recommendedBidId !== timelineWinner.id)
  ) {
    // Prefer timeline only when the model left no pick, or when its pick is
    // among the price-tied set (do not override a cheaper bid).
    const minAmount = Math.min(
      ...context.bids.map((bid) => Number(bid.amount)),
    );
    const currentIsPriceTied =
      recommendedBidId != null &&
      amountsAreTied(
        Number(
          context.bids.find((bid) => bid.id === recommendedBidId)?.amount ??
            Number.NaN,
        ),
        minAmount,
      );
    if (recommendedBidId == null || currentIsPriceTied) {
      recommendedBidId = timelineWinner.id;
      recommendedCompanyName = timelineWinner.companyName;
    }
  }

  if (recommendedBidId != null && cheapest) {
    const recommended =
      context.bids.find((bid) => bid.id === recommendedBidId) ?? null;
    if (
      recommended &&
      recommended.id !== cheapest.id &&
      timelinePremiumUnjustified(recommended, cheapest)
    ) {
      recommendedBidId = cheapest.id;
      recommendedCompanyName = cheapest.companyName;
    }
  }

  return { recommendedBidId, recommendedCompanyName };
}

export function parseDailyPenaltyPercent(
  text: string | undefined | null,
): number | null {
  if (!text?.trim()) {
    return null;
  }
  const perDay = text.match(
    /(\d+(?:[.,]\d+)?)\s*%\s*(?:per\s+day|\/\s*day|a\s+day|daily|в\s+день|ต่อวัน)/i,
  );
  if (perDay) {
    return Number.parseFloat(perDay[1].replace(',', '.'));
  }
  if (/delay|penalty|liquidated|неуст|ค่าปรับ/i.test(text)) {
    const anyPct = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (anyPct) {
      return Number.parseFloat(anyPct[1].replace(',', '.'));
    }
  }
  return null;
}

export function effectiveAdvancePercent(bid: BidAnalysisBidInput): number | null {
  const terms = bid.terms?.contractTerms;
  if (!terms) {
    return null;
  }
  if (terms.advancePaymentAmount != null && terms.advancePaymentAmount > 0) {
    const amount = Number(bid.amount);
    if (amount > 0) {
      return (terms.advancePaymentAmount / amount) * 100;
    }
  }
  if (terms.advancePaymentPercent != null && terms.advancePaymentPercent >= 0) {
    return terms.advancePaymentPercent;
  }
  return null;
}

export function serializeBidForEmployerAnalysis(bid: BidAnalysisBidInput) {
  const contract = bid.terms?.contractTerms;
  return {
    id: bid.id,
    companyName: bid.companyName,
    amountThb: Number(bid.amount),
    durationDays: bid.durationDays,
    effectiveDurationDays: bidDurationDays(bid),
    scopeSummary: bid.terms?.scopeSummary ?? null,
    approach: bid.terms?.approach ?? null,
    notes: bid.terms?.notes ?? null,
    lineItems: bid.terms?.lineItems ?? [],
    contractTerms: contract
      ? {
          advancePaymentPercent: contract.advancePaymentPercent ?? null,
          advancePaymentAmountThb: contract.advancePaymentAmount ?? null,
          effectiveAdvancePercent: effectiveAdvancePercent(bid),
          retentionPercent: contract.retentionPercent ?? null,
          retentionLimitPercent: contract.retentionLimitPercent ?? null,
          defectNotificationMonths: contract.defectNotificationMonths ?? null,
          delayDamagesNotes: contract.delayDamagesNotes ?? null,
          parsedDailyPenaltyPercent: parseDailyPenaltyPercent(
            contract.delayDamagesNotes,
          ),
          contractPeriodMonths: contract.contractPeriodMonths ?? null,
          worksStartDate: contract.worksStartDate ?? null,
          worksFinishDate: contract.worksFinishDate ?? null,
          specialConditions: contract.specialConditions ?? null,
        }
      : null,
  };
}

export function employerContractTermNotes(
  bid: BidAnalysisBidInput,
  allBids: BidAnalysisBidInput[],
): { strengths: string[]; weaknesses: string[]; riskFlags: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const riskFlags: string[] = [];

  const advance = effectiveAdvancePercent(bid);
  const otherAdvances = allBids
    .map((item) => effectiveAdvancePercent(item))
    .filter((value): value is number => value != null);
  if (advance != null && otherAdvances.length > 0) {
    const minAdvance = Math.min(...otherAdvances);
    const maxAdvance = Math.max(...otherAdvances);
    if (advance <= minAdvance && advance < maxAdvance) {
      strengths.push(
        `Lower advance payment (${advance.toFixed(1)}%) — less upfront exposure for you`,
      );
    } else if (advance >= maxAdvance && advance > minAdvance) {
      weaknesses.push(
        `Higher advance payment (${advance.toFixed(1)}%) — more upfront risk for you`,
      );
    }
  } else if (advance != null && advance > 20) {
    riskFlags.push(`High advance (${advance.toFixed(1)}%) increases employer cash-flow risk`);
  }

  const penalty = parseDailyPenaltyPercent(
    bid.terms?.contractTerms?.delayDamagesNotes,
  );
  const otherPenalties = allBids
    .map((item) =>
      parseDailyPenaltyPercent(item.terms?.contractTerms?.delayDamagesNotes),
    )
    .filter((value): value is number => value != null);
  if (penalty != null && otherPenalties.length > 0) {
    const maxPenalty = Math.max(...otherPenalties);
    const minPenalty = Math.min(...otherPenalties);
    if (penalty >= maxPenalty && penalty > minPenalty) {
      strengths.push(
        `Stronger delay damages (${penalty}%/day) — better protection if works run late`,
      );
    } else if (penalty <= minPenalty && penalty < maxPenalty) {
      weaknesses.push(
        `Weaker delay damages (${penalty}%/day) — less protection for you vs other bids`,
      );
    }
  }

  const retention = bid.terms?.contractTerms?.retentionPercent;
  if (retention != null && retention >= 10) {
    strengths.push(`${retention}% retention holdback stated`);
  }

  const warranty = bid.terms?.contractTerms?.defectNotificationMonths;
  const otherWarranties = allBids
    .map((item) => item.terms?.contractTerms?.defectNotificationMonths)
    .filter((value): value is number => value != null);
  if (warranty != null && otherWarranties.length > 1) {
    const maxWarranty = Math.max(...otherWarranties);
    const minWarranty = Math.min(...otherWarranties);
    if (warranty >= maxWarranty && warranty > minWarranty) {
      strengths.push(
        `Longer defect notification (${warranty} months) — more protection for you`,
      );
    } else if (warranty <= minWarranty && warranty < maxWarranty) {
      weaknesses.push(
        `Shorter defect notification (${warranty} months) — less protection for you`,
      );
    }
  }

  const start = parseWorksIsoDate(bid.terms?.contractTerms?.worksStartDate);
  const otherStarts = allBids
    .map((item) =>
      parseWorksIsoDate(item.terms?.contractTerms?.worksStartDate),
    )
    .filter((value): value is string => value != null);
  if (start != null && otherStarts.length > 1) {
    const earliest = [...otherStarts].sort()[0]!;
    const latest = [...otherStarts].sort()[otherStarts.length - 1]!;
    if (start === earliest && start < latest) {
      strengths.push(`Earlier works start (${start})`);
    } else if (start === latest && start > earliest) {
      weaknesses.push(`Later works start (${start})`);
    }
  } else if (start == null && otherStarts.length > 0) {
    riskFlags.push('Works start date not specified');
  }

  const duration = bidDurationDays(bid);
  const otherDurations = allBids
    .map((item) => bidDurationDays(item))
    .filter((value): value is number => value != null);
  if (duration != null && otherDurations.length > 1) {
    const shortest = Math.min(...otherDurations);
    const longest = Math.max(...otherDurations);
    if (duration === shortest && duration < longest) {
      strengths.push(`Shorter duration (${duration} days)`);
    } else if (duration === longest && duration > shortest) {
      weaknesses.push(`Longer duration (${duration} days)`);
    }
  } else if (duration == null && otherDurations.length > 0) {
    riskFlags.push('Works duration not specified');
  }

  const finish = parseWorksIsoDate(bid.terms?.contractTerms?.worksFinishDate);
  const otherFinishes = allBids
    .map((item) =>
      parseWorksIsoDate(item.terms?.contractTerms?.worksFinishDate),
    )
    .filter((value): value is string => value != null);
  if (finish != null && otherFinishes.length > 1) {
    const earliestFinish = [...otherFinishes].sort()[0]!;
    const latestFinish = [...otherFinishes].sort()[
      otherFinishes.length - 1
    ]!;
    if (finish === earliestFinish && finish < latestFinish) {
      strengths.push(`Earlier works finish (${finish})`);
    } else if (finish === latestFinish && finish > earliestFinish) {
      weaknesses.push(`Later works finish (${finish})`);
    }
  }

  return { strengths, weaknesses, riskFlags };
}
