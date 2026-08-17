'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { formatThb } from '@/lib/estimate';
import { bidWorksSubtotalForCompare } from '@/lib/bid-cost-adjustments';
import { fetchProjectContract, type ProjectContract } from '@/lib/contracts';
import { BidChat } from '@/components/BidChat';
import { ClientCommercialProposalPanel } from '@/components/ClientCommercialProposalPanel';
import { ClientCounterOfferPanel } from '@/components/ClientCounterOfferPanel';
import { ContractAddendaPanel } from '@/components/ContractAddendaPanel';
import { ContractDocumentEditor } from '@/components/ContractDocumentEditor';
import { CustomContractPreview } from '@/components/CustomContractPreview';
import { ContractSigningPanel } from '@/components/ContractSigningPanel';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import { ClientContractorProfilePanel } from '@/components/ClientContractorProfilePanel';
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
  isDesign?: boolean;
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
  isDesign = false,
}: BidApplicationCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [contract, setContract] = useState<ProjectContract | null>(null);
  const isOpen = expanded;

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);
  const amount = bid.amount != null ? Number(bid.amount) : null;
  const worksAmount =
    amount != null ? bidWorksSubtotalForCompare(bid.terms, amount) : null;
  const delta =
    worksAmount != null && ballparkMid && ballparkMid > 0
      ? Math.round(((worksAmount - ballparkMid) / ballparkMid) * 100)
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
          {bid.companyName ??
            t(isDesign ? 'common.designer' : 'common.contractor')}
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
            <ClientContractorProfilePanel
              projectId={projectId}
              bidId={bid.id}
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
                isDesign={isDesign}
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
              {contract && !contract.hasCustomContract && (
                <ContractDocumentEditor
                  projectId={projectId}
                  contract={contract}
                  onSaved={setContract}
                />
              )}
              {contract?.hasCustomContract && (
                <CustomContractPreview
                  projectId={projectId}
                  contract={contract}
                />
              )}
              <ContractAddendaPanel
                projectId={projectId}
                enabled={Boolean(contract?.fullySigned)}
                reusedSignatureDataUrl={
                  contract?.clientSignatureDataUrl ?? null
                }
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
                name:
                  bid.companyName ??
                  t(isDesign ? 'common.designer' : 'common.contractor'),
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
              isDesign={isDesign}
            />
          )}
        </div>
      )}
    </li>
  );
}
