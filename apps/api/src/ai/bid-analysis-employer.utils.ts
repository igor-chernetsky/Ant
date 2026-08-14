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
- Flag missing worksStartDate / worksFinishDate / durationDays as employer risk when other bids provide them.

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

export function buildEmployerComparisonFacts(context: BidAnalysisContext): string {
  const { bids } = context;
  if (bids.length < 2) {
    return '';
  }

  const lines: string[] = [
    'VERIFIED NUMERIC RANKINGS (binding — do not invert these comparisons):',
  ];

  const byPrice = [...bids].sort(
    (a, b) => Number(a.amount) - Number(b.amount),
  );
  lines.push('Total price — LOWER is BETTER for the employer:');
  byPrice.forEach((bid, index) => {
    const marker =
      index === 0
        ? ' ← LOWEST (best for employer)'
        : index === byPrice.length - 1
          ? ' ← HIGHEST'
          : '';
    lines.push(
      `  ${index + 1}. ${bidLabel(bid)}: ${formatThb(Number(bid.amount))}${marker}`,
    );
  });

  const advanceRows = bids
    .map((bid) => ({ bid, advance: effectiveAdvancePercent(bid) }))
    .filter((row): row is { bid: BidAnalysisBidInput; advance: number } =>
      row.advance != null,
    )
    .sort((a, b) => a.advance - b.advance);
  if (advanceRows.length >= 2) {
    lines.push('Advance payment — LOWER % is BETTER for the employer:');
    advanceRows.forEach((row, index) => {
      const marker =
        index === 0
          ? ' ← LOWEST (best for employer)'
          : index === advanceRows.length - 1
            ? ' ← HIGHEST (worst for employer)'
            : '';
      lines.push(
        `  ${bidLabel(row.bid)}: ${row.advance.toFixed(1)}%${marker}`,
      );
    });
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
  if (warrantyRows.length >= 2) {
    lines.push(
      'Defect notification / warranty — LONGER is BETTER for the employer:',
    );
    warrantyRows.forEach((row, index) => {
      const marker =
        index === 0
          ? ' ← SHORTEST (worst for employer)'
          : index === warrantyRows.length - 1
            ? ' ← LONGEST (best for employer)'
            : '';
      lines.push(
        `  ${bidLabel(row.bid)}: ${row.months} months${marker}`,
      );
    });
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
  if (startRows.length >= 2) {
    lines.push(
      'Works start date — EARLIER is BETTER for the employer when price/terms are comparable:',
    );
    startRows.forEach((row, index) => {
      const marker =
        index === 0
          ? ' ← EARLIEST (best for employer)'
          : index === startRows.length - 1
            ? ' ← LATEST'
            : '';
      lines.push(`  ${bidLabel(row.bid)}: ${row.start}${marker}`);
    });
  }

  const durationRows = bids
    .map((bid) => ({ bid, days: bidDurationDays(bid) }))
    .filter(
      (row): row is { bid: BidAnalysisBidInput; days: number } =>
        row.days != null,
    )
    .sort((a, b) => a.days - b.days);
  if (durationRows.length >= 2) {
    lines.push(
      'Works duration — SHORTER is BETTER for the employer when price/terms are comparable:',
    );
    durationRows.forEach((row, index) => {
      const marker =
        index === 0
          ? ' ← SHORTEST (best for employer)'
          : index === durationRows.length - 1
            ? ' ← LONGEST'
            : '';
      lines.push(`  ${bidLabel(row.bid)}: ${row.days} days${marker}`);
    });
  }

  const finishRows = bids
    .map((bid) => ({
      bid,
      finish: parseWorksIsoDate(bid.terms?.contractTerms?.worksFinishDate),
    }))
    .filter(
      (row): row is { bid: BidAnalysisBidInput; finish: string } =>
        row.finish != null,
    )
    .sort((a, b) => a.finish.localeCompare(b.finish));
  if (finishRows.length >= 2) {
    lines.push(
      'Works finish date — EARLIER is BETTER for the employer when price/terms are comparable:',
    );
    finishRows.forEach((row, index) => {
      const marker =
        index === 0
          ? ' ← EARLIEST finish (best for employer)'
          : index === finishRows.length - 1
            ? ' ← LATEST finish'
            : '';
      lines.push(`  ${bidLabel(row.bid)}: ${row.finish}${marker}`);
    });
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

export function sanitizeEmployerReasoning(
  text: string,
  context: BidAnalysisContext,
): string {
  if (!text?.trim()) {
    return text;
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const kept = sentences.filter(
    (sentence) => !sentenceContradictsEmployerFacts(sentence, context),
  );
  return kept.join(' ').trim();
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

export function enforceEmployerBidAnalysis(
  result: BidAnalysisResult,
  context: BidAnalysisContext,
): BidAnalysisResult {
  const factualNarrative = buildEmployerFactualNarrative(context);
  const sanitizedSummary = sanitizeEmployerReasoning(result.summary, context);
  const sanitizedReasoning = sanitizeEmployerReasoning(result.reasoning, context);

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

  const timelineWinner = pickTimelineTiebreaker(context.bids);
  let recommendedBidId = result.recommendedBidId;
  let recommendedCompanyName = result.recommendedCompanyName;
  let summary =
    factualNarrative && !sanitizedSummary.includes(factualNarrative)
      ? `${factualNarrative} ${sanitizedSummary}`.trim()
      : sanitizedSummary || factualNarrative;
  let reasoning =
    factualNarrative && !sanitizedReasoning.includes(factualNarrative)
      ? `${factualNarrative}\n\n${sanitizedReasoning}`.trim()
      : sanitizedReasoning || factualNarrative;
  let confidence = result.confidence;

  if (
    timelineWinner &&
    (recommendedBidId == null || recommendedBidId !== timelineWinner.id)
  ) {
    // Prefer timeline only when AI left no pick, or when the current pick is
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
      const tieNote = `With matching price and commercial terms, ${bidLabel(timelineWinner)} is preferred for the better works schedule.`;
      if (!summary.includes('works schedule') && !summary.includes('starts earlier')) {
        summary = `${summary} ${tieNote}`.trim();
      }
      if (!reasoning.includes(tieNote)) {
        reasoning = `${reasoning}\n\n${tieNote}`.trim();
      }
      confidence = Math.max(confidence, 0.55);
    }
  }

  return {
    ...result,
    recommendedBidId,
    recommendedCompanyName,
    summary,
    reasoning,
    comparisons,
    confidence,
  };
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
