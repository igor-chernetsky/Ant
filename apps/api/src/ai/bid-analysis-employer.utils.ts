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
- Shorter timeline can be a strength ONLY if scope and quality are comparable — do not treat speed alone as decisive.

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

const NUMERIC_TERM_BULLET_RE =
  /\b(price|cost|amount|advance|payment|upfront|warranty|defect|notification|retention|penalty|damages|thb|฿|months?|higher|lower|cheaper|expensive|дорог|дешев|аванс|гарант)\b/i;

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

  const summary =
    factualNarrative && !sanitizedSummary.includes(factualNarrative)
      ? `${factualNarrative} ${sanitizedSummary}`.trim()
      : sanitizedSummary || factualNarrative;

  const reasoning =
    factualNarrative && !sanitizedReasoning.includes(factualNarrative)
      ? `${factualNarrative}\n\n${sanitizedReasoning}`.trim()
      : sanitizedReasoning || factualNarrative;

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
    summary,
    reasoning,
    comparisons,
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

  return { strengths, weaknesses, riskFlags };
}
