'use client';

import { useState } from 'react';
import { formatThb } from '@/lib/estimate';
import { BidChat } from '@/components/BidChat';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import type { Bid } from '@/lib/tendering';

interface BidApplicationCardProps {
  bid: Bid;
  ballparkMid?: number | null;
  tenderStatus: string;
  busy?: boolean;
  currentUserId?: string;
  projectId: string;
  onSelect?: (bid: Bid) => void;
}

  bid,
  ballparkMid,
  tenderStatus,
  busy = false,
  currentUserId,
  projectId,
  onSelect,
}: BidApplicationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const amount = Number(bid.amount);
  const delta =
    ballparkMid && ballparkMid > 0
      ? Math.round(((amount - ballparkMid) / ballparkMid) * 100)
      : null;

  const canSelect =
    (tenderStatus === 'open' || tenderStatus === 'closed') &&
    bid.status === 'submitted';

  return (
    <li className={`bid-application-card${expanded ? ' bid-application-card--expanded' : ''}`}>
      <div className="bid-application-card-bar">
        <button
          type="button"
          className="bid-application-card-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="bid-application-card-chevron" aria-hidden>
            {expanded ? '▾' : '▸'}
          </span>
          <span className="bid-application-card-primary">
            <strong className="bid-application-card-company">
              {bid.companyName ?? 'Contractor'}
            </strong>
            <span className="bid-application-card-amount">{formatThb(amount)}</span>
          </span>
          <span className="bid-application-card-meta muted">
            {bid.durationDays != null && (
              <span>{bid.durationDays} days</span>
            )}
            {delta !== null && (
              <span>
                {delta >= 0 ? '+' : ''}
                {delta}% vs ballpark
              </span>
            )}
            <span>{new Date(bid.submittedAt).toLocaleDateString()}</span>
          </span>
        </button>

        <div className="bid-application-card-badges">
          {bid.status === 'selected' && (
            <span className="readiness-badge">Selected</span>
          )}
          {bid.status === 'rejected' && (
            <span className="status-pill">Not selected</span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="bid-application-card-body">
          <BidProposalSummary bid={bid} ballparkMid={ballparkMid} detailsOnly />

          <div className="bid-line-actions bid-proposal-actions">
            {canSelect && onSelect && (
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => onSelect(bid)}
              >
                Select this bid
              </button>
            )}
          </div>

          {currentUserId && (
            <BidChat
              bidId={bid.id}
              projectId={projectId}
              currentUserId={currentUserId}
              title={`Chat with ${bid.companyName ?? 'contractor'}`}
            />
          )}
        </div>
      )}
    </li>
  );
}
