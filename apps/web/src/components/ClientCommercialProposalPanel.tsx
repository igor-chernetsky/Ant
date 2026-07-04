'use client';

import { useState } from 'react';
import {
  BidContractTermsFields,
  contractTermsFromBid,
  pickClientContractTerms,
} from '@/components/BidContractTermsFields';
import type { BidContractTerms } from '@/lib/tendering';
import { updateBidContractTerms, type Bid } from '@/lib/tendering';

interface ClientCommercialProposalPanelProps {
  projectId: string;
  bid: Bid;
  projectTitle?: string;
  projectDistrict?: string | null;
  onBidUpdated?: (bid: Bid) => void;
}

export function ClientCommercialProposalPanel({
  projectId,
  bid,
  projectTitle,
  projectDistrict,
  onBidUpdated,
}: ClientCommercialProposalPanelProps) {
  const [contractTerms, setContractTerms] = useState<BidContractTerms>(() =>
    contractTermsFromBid(bid.terms, {
      title: projectTitle,
      district: projectDistrict,
    }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateBidContractTerms(
        projectId,
        bid.id,
        pickClientContractTerms(contractTerms),
      );
      onBidUpdated?.(updated);
      setSaved(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to save contract terms',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="client-commercial-proposal-panel">
      <h4 className="tender-subsection-title">Commercial proposal terms</h4>
      <p className="muted client-commercial-proposal-hint">
        Adjust site details and propose payment, schedule, and special
        conditions. Contractor proposal fields are read-only.
      </p>

      <BidContractTermsFields
        value={contractTerms}
        onChange={setContractTerms}
        audience="client"
        projectTitle={projectTitle}
        projectDistrict={projectDistrict}
        disabled={busy}
      />

      <div className="bid-contract-terms-actions">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => void handleSave()}
        >
          {busy ? 'Saving…' : 'Save terms'}
        </button>
        {saved && (
          <p className="muted bid-contract-terms-download-hint">Terms saved.</p>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
