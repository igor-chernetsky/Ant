'use client';

import { formatThb } from '@/lib/estimate';
import type { BidOffer } from '@/lib/tendering';

interface BidOfferSummaryProps {
  offer: BidOffer;
}

export function BidOfferSummary({ offer }: BidOfferSummaryProps) {
  const terms = offer.terms;

  return (
    <article className="bid-offer-summary">
      <p className="bid-offer-meta muted">
        {offer.authorRole === 'client' ? 'Client' : 'You'} ·{' '}
        {new Date(offer.createdAt).toLocaleString()}
      </p>
      <p className="bid-offer-amount">
        {formatThb(Number(offer.amount))}
        {offer.durationDays != null && ` · ${offer.durationDays} days`}
      </p>

      {terms?.scopeSummary && (
        <div className="bid-proposal-block">
          <h4>Scope</h4>
          <p>{terms.scopeSummary}</p>
        </div>
      )}

      {(offer.note || terms?.notes) && (
        <div className="bid-proposal-block">
          <h4>Comment</h4>
          <p className="bid-proposal-text">{offer.note ?? terms?.notes}</p>
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
          <ul className="bid-breakdown-grid" aria-label="Cost breakdown">
            {terms.lineItems.map((item, index) => (
              <li key={index} className="bid-breakdown-card">
                <span className="bid-breakdown-card-trade">{item.trade}</span>
                {item.description && (
                  <span className="bid-breakdown-card-desc muted">
                    {item.description}
                  </span>
                )}
                <span className="bid-breakdown-card-amount">
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
