import { Injectable } from '@nestjs/common';
import {
  BidAnalysisContext,
  BidAnalysisResult,
} from './bid-analysis.types';
import { employerContractTermNotes } from './bid-analysis-employer.utils';

@Injectable()
export class BidAnalysisFallbackService {
  analyzeBids(context: BidAnalysisContext): BidAnalysisResult {
    const bids = [...context.bids].sort(
      (a, b) => Number(a.amount) - Number(b.amount),
    );
    const recommended = bids[0] ?? null;
    const ballparkMid = context.ballparkMid ?? null;

    const comparisons = context.bids.map((bid) => {
      const amount = Number(bid.amount);
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      const riskFlags: string[] = [];

      if (recommended && bid.id === recommended.id) {
        strengths.push('Lowest submitted price');
      } else if (recommended) {
        const delta = amount - Number(recommended.amount);
        if (delta > 0) {
          weaknesses.push(`Higher than lowest bid by ${delta.toLocaleString()} THB`);
        }
      }

      if (ballparkMid && ballparkMid > 0) {
        const pct = Math.round(((amount - ballparkMid) / ballparkMid) * 100);
        if (pct > 15) {
          riskFlags.push('Well above ballpark midpoint');
        } else if (pct < -15) {
          riskFlags.push('Well below ballpark midpoint — verify scope coverage');
        }
      }

      if (!bid.terms?.scopeSummary?.trim()) {
        riskFlags.push('Scope summary missing');
      }
      if (!bid.terms?.approach?.trim()) {
        riskFlags.push('Implementation approach not provided');
      }
      if (bid.durationDays == null) {
        riskFlags.push('Timeline not specified');
      } else {
        strengths.push(`${bid.durationDays}-day timeline stated`);
      }

      const employerTerms = employerContractTermNotes(bid, context.bids);
      strengths.push(...employerTerms.strengths);
      weaknesses.push(...employerTerms.weaknesses);
      riskFlags.push(...employerTerms.riskFlags);

      return {
        bidId: bid.id,
        companyName: bid.companyName,
        strengths,
        weaknesses,
        riskFlags,
      };
    });

    const summary = recommended
      ? `${recommended.companyName ?? 'One contractor'} submitted the lowest price. Review scope and employer-side contract terms (advance, penalties, retention) before awarding — automated fallback only compares basic bid fields.`
      : 'No bids available to compare.';

    const reasoning = recommended
      ? `With limited AI configuration, the fallback ranks bids primarily by total price from the employer's perspective. ${recommended.companyName ?? 'The lowest bidder'} at ${Number(recommended.amount).toLocaleString()} THB is the default pick, but validate scope, exclusions, timeline, and contract terms (lower advance and stronger delay damages favour you as employer).`
      : 'Add at least two contractor bids before running analysis.';

    return {
      recommendedBidId: recommended?.id ?? null,
      recommendedCompanyName: recommended?.companyName ?? null,
      summary,
      reasoning,
      comparisons,
      confidence: 0.3,
      provider: 'fallback',
    };
  }
}
