'use client';

import { formatThb } from '@/lib/estimate';
import type { Bid } from '@/lib/tendering';

interface BidProposalSummaryProps {
  bid: Bid;
  ballparkMid?: number | null;
  compact?: boolean;
}

export function BidProposalSummary({
  bid,
  ballparkMid,
  compact = false,
}: BidProposalSummaryProps) {
  const amount = Number(bid.amount);
  const delta =
    ballparkMid && ballparkMid > 0
      ? Math.round(((amount - ballparkMid) / ballparkMid) * 100)
      : null;
  const terms = bid.terms;

  return (
    <article className={`bid-proposal-summary${compact ? ' bid-proposal-summary--compact' : ''}`}>
      <header className="bid-proposal-header">
        <div>
          <strong>{bid.companyName ?? 'Contractor'}</strong>
          <div className="bid-proposal-meta muted">
            {bid.durationDays != null && (
              <span>{bid.durationDays} days estimated</span>
            )}
            {delta !== null && (
              <span>
                {delta >= 0 ? '+' : ''}
                {delta}% vs ballpark
              </span>
            )}
            <span>
              Submitted {new Date(bid.submittedAt).toLocaleString()}
            </span>
          </div>
        </div>
        <span className="estimate-line-amount">{formatThb(amount)}</span>
      </header>

      {terms?.scopeSummary && (
        <div className="bid-proposal-block">
          <h4>Scope</h4>
          <p>{terms.scopeSummary}</p>
        </div>
      )}

      {terms?.notes && (
        <div className="bid-proposal-block">
          <h4>Comment</h4>
          <p className="bid-proposal-text">{terms.notes}</p>
        </div>
      )}

      {terms?.approach && (
        <div className="bid-proposal-block">
          <h4>Implementation approach</h4>
          <p className="bid-proposal-text bid-proposal-text--pre">
            {terms.approach}
          </p>
        </div>
      )}

      {terms?.lineItems && terms.lineItems.length > 0 && (
        <div className="bid-proposal-block">
          <h4>Cost breakdown</h4>
          <ul className="estimate-lines bid-breakdown-lines">
            {terms.lineItems.map((item, index) => (
              <li key={index} className="estimate-line">
                <div>
                  <strong>{item.trade}</strong>
                  <span className="muted estimate-line-trade">
                    {item.description}
                  </span>
                </div>
                <span className="estimate-line-amount">
                  {formatThb(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
