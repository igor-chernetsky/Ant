import type { BidAnalysisBidInput } from './bid-analysis.types';

/** Prompt block: evaluate every bid from the employer / client perspective only. */
export function employerBidAnalysisPromptRules(): string {
  return `AUDIENCE (mandatory): You advise the EMPLOYER / CLIENT (the project owner), NOT contractors.
Never praise terms because they are favourable to the contractor. Flip the logic:

Contract & payment terms — employer perspective:
- Advance payment: LOWER % or amount is BETTER for the employer (less upfront exposure). Higher advance = WEAKNESS or RISK for the employer.
- Delay damages / liquidated damages: HIGHER daily rate (e.g. 0.3%/day vs 0.1%/day) is BETTER for the employer (stronger protection). Lower penalty = WEAKER protection for the employer — say so explicitly.
- Retention: HIGHER retention % is generally BETTER for the employer (more holdback until completion).
- Warranty / defect period: LONGER is BETTER for the employer.
- Shorter timeline can be a strength ONLY if scope and quality are comparable — do not treat speed alone as decisive.

When comparing two bids on the same term, always explain why it helps or hurts the EMPLOYER.
Do NOT write "reduces financial risk" for terms that mainly protect the contractor (low advance, low penalties).

Price & scope:
- Lower total price is usually better for the employer IF scope coverage is comparable.
- Flag under-scoped or vague bids as employer risk even when cheap.

Write strengths/weaknesses/riskFlags from the employer's point of view only.`;
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

  return { strengths, weaknesses, riskFlags };
}
