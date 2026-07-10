'use client';

import { useTranslation } from '@/components/LocaleProvider';
import { formatThb } from '@/lib/estimate';
import type { Bid } from '@/lib/tendering';

interface BidProposalSummaryProps {
  bid: Bid;
  ballparkMid?: number | null;
  compact?: boolean;
  collapsed?: boolean;
  detailsOnly?: boolean;
}

export function BidProposalSummary({
  bid,
  ballparkMid,
  compact = false,
  collapsed = false,
  detailsOnly = false,
}: BidProposalSummaryProps) {
  const { t } = useTranslation();
  const amount = bid.amount != null ? Number(bid.amount) : null;
  const delta =
    amount != null && ballparkMid && ballparkMid > 0
      ? Math.round(((amount - ballparkMid) / ballparkMid) * 100)
      : null;
  const terms = bid.terms;

  const details = (
    <>
      {terms?.scopeSummary && (
        <div className="bid-proposal-block">
          <h4>{t('bid.scope')}</h4>
          <p>{terms.scopeSummary}</p>
        </div>
      )}

      {terms?.notes && (
        <div className="bid-proposal-block">
          <h4>{t('bid.comment')}</h4>
          <p className="bid-proposal-text">{terms.notes}</p>
        </div>
      )}

      {terms?.approach && (
        <div className="bid-proposal-block">
          <h4>{t('bid.implementationApproach')}</h4>
          <p className="bid-proposal-text bid-proposal-text--pre">
            {terms.approach}
          </p>
        </div>
      )}

      {terms?.lineItems && terms.lineItems.length > 0 && (
        <div className="bid-proposal-block">
          <h4>{t('bid.costBreakdown')}</h4>
          <ul
            className="bid-breakdown-grid"
            aria-label={t('bid.costBreakdownAria')}
          >
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
    </>
  );

  if (detailsOnly) {
    return (
      <article className="bid-proposal-summary bid-proposal-summary--details">
        {details}
      </article>
    );
  }

  if (collapsed) {
    return null;
  }

  return (
    <article
      className={`bid-proposal-summary${compact ? ' bid-proposal-summary--compact' : ''}`}
    >
      <header className="bid-proposal-header">
        <div>
          <strong>{bid.companyName ?? t('common.contractor')}</strong>
          <div className="bid-proposal-meta muted">
            {bid.durationDays != null && (
              <span>
                {t('common.daysEstimated', { n: bid.durationDays })}
              </span>
            )}
            {delta !== null && (
              <span>
                {t('bid.vsBallpark', {
                  delta: `${delta >= 0 ? '+' : ''}${delta}`,
                })}
              </span>
            )}
            {(bid.submittedAt || bid.enrolledAt) && (
              <span>
                {bid.submittedAt ? t('bid.submitted') : t('bid.enrolled')}
                {new Date(bid.submittedAt ?? bid.enrolledAt!).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <span className="estimate-line-amount">
          {amount != null ? formatThb(amount) : t('common.dash')}
        </span>
      </header>
      {details}
    </article>
  );
}
