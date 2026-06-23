'use client';

import { useState } from 'react';
import { formatThb } from '@/lib/estimate';
import { BidChat } from '@/components/BidChat';
import { ClientCommercialProposalPanel } from '@/components/ClientCommercialProposalPanel';
import { ClientCounterOfferPanel } from '@/components/ClientCounterOfferPanel';
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
  /** Show full bid details without collapse (bids comparison page). */
  alwaysExpanded?: boolean;
  /** Client-only: counter-offer negotiation on bids page */
  clientCounterOffer?: {
    projectId: string;
    tenderOpen: boolean;
    projectTitle?: string;
    projectDistrict?: string | null;
    onBidUpdated?: (bid: Bid) => void;
  };
  clarificationMode?: 'open_chat' | 'structured_qa';
}

export function BidApplicationCard({
  bid,
  ballparkMid,
  tenderStatus,
  busy = false,
  currentUserId,
  projectId,
  onSelect,
  alwaysExpanded = false,
  clientCounterOffer,
  clarificationMode = 'open_chat',
}: BidApplicationCardProps) {
  const [expanded, setExpanded] = useState(alwaysExpanded);
  const isOpen = alwaysExpanded || expanded;
  const amount = bid.amount != null ? Number(bid.amount) : null;
  const delta =
    amount != null && ballparkMid && ballparkMid > 0
      ? Math.round(((amount - ballparkMid) / ballparkMid) * 100)
      : null;

  const canSelect =
    (tenderStatus === 'open' || tenderStatus === 'closed') &&
    bid.status === 'submitted';

  const headerContent = (
    <>
      <span className="bid-application-card-primary">
        <strong className="bid-application-card-company">
          {bid.companyName ?? 'Contractor'}
        </strong>
            <span className="bid-application-card-amount">
              {amount != null ? formatThb(amount) : 'No proposal yet'}
            </span>
      </span>
      <span className="bid-application-card-meta muted">
        {bid.contenderNumber != null && <span>#{bid.contenderNumber}</span>}
        {bid.durationDays != null && <span>{bid.durationDays} days</span>}
        {delta !== null && (
          <span>
            {delta >= 0 ? '+' : ''}
            {delta}% vs ballpark
          </span>
        )}
        {(bid.submittedAt || bid.enrolledAt) && (
          <span>
            {new Date(bid.submittedAt ?? bid.enrolledAt!).toLocaleDateString()}
          </span>
        )}
      </span>
    </>
  );

  return (
    <li
      className={`bid-application-card${isOpen ? ' bid-application-card--expanded' : ''}${alwaysExpanded ? ' bid-application-card--flat' : ''}`}
    >
      <div className="bid-application-card-bar">
        {alwaysExpanded ? (
          <div className="bid-application-card-static-header">{headerContent}</div>
        ) : (
          <button
            type="button"
            className="bid-application-card-toggle"
            aria-expanded={isOpen}
            onClick={() => setExpanded((open) => !open)}
          >
            <span className="bid-application-card-chevron" aria-hidden>
              {isOpen ? '▾' : '▸'}
            </span>
            {headerContent}
          </button>
        )}

        <div className="bid-application-card-badges">
          {bid.status === 'clarifying' && (
            <span className="status-pill">Clarifying</span>
          )}
          {bid.status === 'enrolled' && (
            <span className="status-pill">Enrolled</span>
          )}
          {bid.status === 'selected' && (
            <span className="readiness-badge">Selected</span>
          )}
          {bid.status === 'rejected' && (
            <span className="status-pill">Not selected</span>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="bid-application-card-body">
          <BidProposalSummary bid={bid} ballparkMid={ballparkMid} detailsOnly />

          {clientCounterOffer &&
            (bid.status === 'submitted' ||
              bid.status === 'selected' ||
              bid.status === 'rejected') && (
              <ClientCommercialProposalPanel
                projectId={clientCounterOffer.projectId}
                bid={bid}
                projectTitle={clientCounterOffer.projectTitle}
                projectDistrict={clientCounterOffer.projectDistrict}
                onBidUpdated={clientCounterOffer.onBidUpdated}
              />
            )}

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

          {currentUserId && clarificationMode === 'open_chat' && (
            <BidChat
              bidId={bid.id}
              projectId={projectId}
              currentUserId={currentUserId}
              title={`Chat with ${bid.companyName ?? 'contractor'}`}
            />
          )}

          {clientCounterOffer && (
            <ClientCounterOfferPanel
              projectId={clientCounterOffer.projectId}
              bid={bid}
              tenderOpen={clientCounterOffer.tenderOpen}
            />
          )}
        </div>
      )}
    </li>
  );
}
