'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { formatThb } from '@/lib/estimate';
import { BidProposalForm, type BidProposalInput } from '@/components/BidProposalForm';
import {
  fetchBidCounterOffers,
  fetchCounterOfferTargets,
  submitClientCounterOffer,
  type Bid,
  type BidContractTerms,
  type BidOffer,
  type DefaultCostBreakdownItem,
} from '@/lib/tendering';

interface ClientCounterOfferPanelProps {
  projectId: string;
  bid: Bid;
  tenderOpen: boolean;
  defaultCostBreakdown?: DefaultCostBreakdownItem[];
  projectTitle?: string;
  projectDistrict?: string | null;
  projectDescription?: string | null;
  projectScopeSummary?: string | null;
  projectContractTerms?: BidContractTerms;
}

export function ClientCounterOfferPanel({
  projectId,
  bid,
  tenderOpen,
  defaultCostBreakdown = [],
  projectTitle,
  projectDistrict,
  projectDescription,
  projectScopeSummary,
  projectContractTerms,
}: ClientCounterOfferPanelProps) {
  const { t } = useTranslation();
  const [offers, setOffers] = useState<BidOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingTargetCount, setPendingTargetCount] = useState(0);
  const [applyToAllPending, setApplyToAllPending] = useState(false);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const [data, targets] = await Promise.all([
        fetchBidCounterOffers(projectId, bid.id),
        fetchCounterOfferTargets(projectId),
      ]);
      setOffers(data);
      setPendingTargetCount(targets.count);
      setApplyToAllPending(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('negotiation.loadFailed'));
      setOffers([]);
      setPendingTargetCount(0);
    } finally {
      setLoading(false);
    }
  }, [projectId, bid.id]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  const handleSubmit = async (input: BidProposalInput) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await submitClientCounterOffer(projectId, bid.id, {
        ...input,
        applyToAllPending: applyToAllPending && pendingTargetCount > 1,
      });
      await loadOffers();
      if (result.sentToBidCount > 1) {
        setSuccess(
          t('negotiation.sentToMany', { count: result.sentToBidCount }),
        );
      } else {
        setSuccess(t('negotiation.sent'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('negotiation.sendFailed'));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const hasClientCounterOffer = offers.some(
    (offer) => offer.authorRole === 'client',
  );
  const canBulkSend =
    pendingTargetCount > 1 && !hasClientCounterOffer && bid.status === 'submitted';

  if (bid.status !== 'submitted') {
    return null;
  }

  return (
    <div className="client-counter-offer-panel">
      <h4 className="tender-subsection-title">{t('negotiation.title')}</h4>
      {loading ? (
        <p className="muted">{t('negotiation.loading')}</p>
      ) : offers.length > 0 ? (
        <ul className="bid-offer-list">
          {offers.map((offer) => (
            <li key={offer.id} className="bid-offer-item">
              <p className="bid-offer-meta muted">
                {offer.authorRole === 'client'
                  ? t('negotiation.yourCounterOffer')
                  : t('common.contractor')}{' '}
                · {new Date(offer.createdAt).toLocaleString()}
              </p>
              <p className="bid-offer-amount">{formatThb(Number(offer.amount))}</p>
              {offer.note && <p className="bid-offer-note">{offer.note}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t('negotiation.noOffers')}</p>
      )}

      {tenderOpen && (
        <div className="client-counter-offer-form-wrap">
          <h4 className="bid-analysis-subtitle">{t('negotiation.sendTitle')}</h4>
          <BidProposalForm
            prefillBid={bid}
            projectTitle={projectTitle}
            projectDistrict={projectDistrict}
            projectDescription={projectDescription}
            projectScopeSummary={projectScopeSummary}
            projectContractTerms={projectContractTerms}
            defaultCostBreakdown={defaultCostBreakdown}
            busy={busy}
            contractTermsAudience="none"
            notesLabel={t('negotiation.commentLabel')}
            scopeLabel={t('bid.scopeOfWorks')}
            scopeHint={t('negotiation.scopeHint')}
            breakdownMode="adjust"
            submitLabel={
              applyToAllPending && canBulkSend
                ? t('negotiation.sendToMany', { count: pendingTargetCount })
                : t('negotiation.sendCounterOffer')
            }
            footerExtra={
              canBulkSend ? (
                <label className="client-counter-offer-bulk-option">
                  <input
                    type="checkbox"
                    checked={applyToAllPending}
                    onChange={(event) =>
                      setApplyToAllPending(event.target.checked)
                    }
                    disabled={busy}
                  />
                  <span>
                    {t('negotiation.bulkOption', {
                      count: pendingTargetCount,
                    })}
                  </span>
                </label>
              ) : null
            }
            onSubmit={handleSubmit}
          />
        </div>
      )}

      {success && <p className="form-success">{success}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
