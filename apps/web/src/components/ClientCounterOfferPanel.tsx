'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatThb } from '@/lib/estimate';
import { BidProposalForm, type BidProposalInput } from '@/components/BidProposalForm';
import {
  fetchBidCounterOffers,
  submitClientCounterOffer,
  type Bid,
  type BidOffer,
} from '@/lib/tendering';

interface ClientCounterOfferPanelProps {
  projectId: string;
  bid: Bid;
  tenderOpen: boolean;
}

export function ClientCounterOfferPanel({
  projectId,
  bid,
  tenderOpen,
}: ClientCounterOfferPanelProps) {
  const [offers, setOffers] = useState<BidOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBidCounterOffers(projectId, bid.id);
      setOffers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load offers');
      setOffers([]);
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
    try {
      await submitClientCounterOffer(projectId, bid.id, input);
      await loadOffers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send counter-offer');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  if (bid.status !== 'submitted') {
    return null;
  }

  return (
    <div className="client-counter-offer-panel">
      <h4 className="tender-subsection-title">Negotiation</h4>
      {loading ? (
        <p className="muted">Loading offer history…</p>
      ) : offers.length > 0 ? (
        <ul className="bid-offer-list">
          {offers.map((offer) => (
            <li key={offer.id} className="bid-offer-item">
              <p className="bid-offer-meta muted">
                {offer.authorRole === 'client' ? 'Your counter-offer' : 'Contractor'} ·{' '}
                {new Date(offer.createdAt).toLocaleString()}
              </p>
              <p className="bid-offer-amount">{formatThb(Number(offer.amount))}</p>
              {offer.note && <p className="bid-offer-note">{offer.note}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No counter-offers yet.</p>
      )}

      {tenderOpen && (
        <div className="client-counter-offer-form-wrap">
          <h4 className="bid-analysis-subtitle">Send counter-offer</h4>
          <BidProposalForm busy={busy} onSubmit={handleSubmit} />
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
