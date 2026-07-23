'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { formatThb } from '@/lib/estimate';
import { fetchProjectContract, type ProjectContract } from '@/lib/contracts';
import { BidChat } from '@/components/BidChat';
import { ClientCommercialProposalPanel } from '@/components/ClientCommercialProposalPanel';
import { ClientCounterOfferPanel } from '@/components/ClientCounterOfferPanel';
import { ContractSigningPanel } from '@/components/ContractSigningPanel';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import { ContractorPortfolioGallery } from '@/components/ContractorPortfolioGallery';
import {
  formatBidWithdrawalReason,
} from '@/components/DeclineProposalDialog';
import type { Bid, BidContractTerms, DefaultCostBreakdownItem } from '@/lib/tendering';

interface BidApplicationCardProps {
  bid: Bid;
  ballparkMid?: number | null;
  tenderStatus: string;
  currency?: string | null;
  busy?: boolean;
  currentUserId?: string;
  projectId: string;
  onSelect?: (bid: Bid) => void;
  /** Initial expanded state for collapsible cards. */
  defaultExpanded?: boolean;
  /** Client-only: counter-offer negotiation on bids page */
  clientCounterOffer?: {
    projectId: string;
    tenderOpen: boolean;
    projectTitle?: string;
    projectDistrict?: string | null;
    projectDescription?: string | null;
    projectScopeSummary?: string | null;
    projectContractTerms?: BidContractTerms;
    defaultCostBreakdown?: DefaultCostBreakdownItem[];
    onBidUpdated?: (bid: Bid) => void;
  };
  clarificationMode?: 'open_chat' | 'structured_qa';
  onContractSigned?: () => void;
}

export function BidApplicationCard({
  bid,
  ballparkMid,
  tenderStatus,
  currency = 'THB',
  busy = false,
  currentUserId,
  projectId,
  onSelect,
  defaultExpanded = false,
  clientCounterOffer,
  clarificationMode = 'open_chat',
  onContractSigned,
}: BidApplicationCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [contract, setContract] = useState<ProjectContract | null>(null);
  const isOpen = expanded;
  const amount = bid.amount != null ? Number(bid.amount) : null;
  const delta =
    amount != null && ballparkMid && ballparkMid > 0
      ? Math.round(((amount - ballparkMid) / ballparkMid) * 100)
      : null;

  const canSelect =
    (tenderStatus === 'open' || tenderStatus === 'closed') &&
    bid.status === 'submitted';

  const contractReadOnly = contract?.fullySigned ?? false;

  const showBidChat =
    Boolean(currentUserId) &&
    (clarificationMode === 'open_chat' ||
      (clarificationMode === 'structured_qa' && bid.status === 'selected'));

  useEffect(() => {
    if (bid.status !== 'selected') {
      setContract(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchProjectContract(projectId);
        if (!cancelled) {
          setContract(data);
        }
      } catch {
        if (!cancelled) {
          setContract(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bid.status, projectId]);

  const declineReason = formatBidWithdrawalReason(
    t,
    bid.withdrawalReason,
    bid.withdrawalNote,
  );
  const isDeclined = bid.status === 'withdrawn' && Boolean(bid.withdrawalReason);

  const headerContent = (
    <>
      <span className="bid-application-card-primary">
        <strong className="bid-application-card-company">
          {bid.companyName ?? t('common.contractor')}
        </strong>
            <span className="bid-application-card-amount">
              {isDeclined
                ? t('bidApplication.declinedProposal')
                : amount != null
                  ? formatThb(amount)
                  : t('bidApplication.noProposalYet')}
            </span>
      </span>
      <span className="bid-application-card-meta muted">
        {bid.contenderNumber != null && <span>#{bid.contenderNumber}</span>}
        {bid.durationDays != null && (
          <span>{t('common.daysCount', { n: bid.durationDays })}</span>
        )}
        {delta !== null && (
          <span>
            {t('bidApplication.vsBallpark', {
              delta: `${delta >= 0 ? '+' : ''}${delta}`,
            })}
          </span>
        )}
        {(bid.submittedAt || bid.enrolledAt || bid.withdrawnAt) && (
          <span>
            {new Date(
              bid.withdrawnAt ?? bid.submittedAt ?? bid.enrolledAt!,
            ).toLocaleDateString()}
          </span>
        )}
      </span>
    </>
  );

  return (
    <li
      className={`bid-application-card${isOpen ? ' bid-application-card--expanded' : ''}`}
    >
      <div className="bid-application-card-bar">
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

        <div className="bid-application-card-badges">
          {bid.status === 'clarifying' && (
            <span className="status-pill">{t('bidApplication.clarifying')}</span>
          )}
          {bid.status === 'enrolled' && (
            <span className="status-pill">{t('bidApplication.enrolled')}</span>
          )}
          {bid.status === 'selected' && (
            <span className="readiness-badge">{t('bidApplication.selected')}</span>
          )}
          {bid.status === 'rejected' && (
            <span className="status-pill">{t('bidApplication.notSelected')}</span>
          )}
          {isDeclined && (
            <span className="status-pill">{t('bidApplication.declinedProposal')}</span>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="bid-application-card-body">
          {isDeclined && declineReason ? (
            <p className="bid-application-decline-reason">
              <strong>{t('bidApplication.declineReasonLabel')}:</strong>{' '}
              {declineReason}
            </p>
          ) : (
            <BidProposalSummary bid={bid} ballparkMid={ballparkMid} detailsOnly />
          )}

          {!isDeclined && (
          <ContractorPortfolioGallery
            contractorId={bid.contractorId}
            companyName={bid.companyName}
          />
          )}

          {!isDeclined && clientCounterOffer &&
            (bid.status === 'submitted' || bid.status === 'rejected') &&
            tenderStatus !== 'awarded' &&
            !contractReadOnly && (
              <ClientCommercialProposalPanel
                projectId={clientCounterOffer.projectId}
                bid={bid}
                projectTitle={clientCounterOffer.projectTitle}
                projectDistrict={clientCounterOffer.projectDistrict}
                projectContractTerms={clientCounterOffer.projectContractTerms}
                readOnly
                onBidUpdated={clientCounterOffer.onBidUpdated}
              />
            )}

          {!isDeclined && bid.status === 'selected' && (
            <div className="contract-draft-panel">
              <ContractSigningPanel
                projectId={projectId}
                bidId={bid.id}
                bidAmount={bid.amount}
                currency={currency}
                contract={contract}
                onSigned={(updated) => {
                  setContract(updated);
                  onContractSigned?.();
                }}
                onAwardReleased={() => onContractSigned?.()}
              />
            </div>
          )}

          <div className="bid-line-actions bid-proposal-actions">
            {canSelect && onSelect && (
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => onSelect(bid)}
              >
                {t('bidApplication.selectThisBid')}
              </button>
            )}
          </div>

          {showBidChat && !isDeclined && (
            <BidChat
              bidId={bid.id}
              projectId={projectId}
              currentUserId={currentUserId!}
              title={t('bidApplication.chatWith', {
                name: bid.companyName ?? t('common.contractor'),
              })}
            />
          )}

          {clientCounterOffer && !isDeclined && (
            <ClientCounterOfferPanel
              projectId={clientCounterOffer.projectId}
              bid={bid}
              tenderOpen={clientCounterOffer.tenderOpen}
              projectTitle={clientCounterOffer.projectTitle}
              projectDistrict={clientCounterOffer.projectDistrict}
              projectDescription={clientCounterOffer.projectDescription}
              projectScopeSummary={clientCounterOffer.projectScopeSummary}
              projectContractTerms={clientCounterOffer.projectContractTerms}
              defaultCostBreakdown={clientCounterOffer.defaultCostBreakdown}
            />
          )}
        </div>
      )}
    </li>
  );
}
