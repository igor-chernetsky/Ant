'use client';

import { useEffect, useState } from 'react';
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
  projectContractTerms?: BidContractTerms;
  readOnly?: boolean;
  onBidUpdated?: (bid: Bid) => void;
}

function buildContractTermsState(
  bid: Bid,
  projectTitle?: string,
  projectDistrict?: string | null,
  projectContractTerms?: BidContractTerms,
): BidContractTerms {
  return contractTermsFromBid(
    bid.terms,
    {
      title: projectTitle,
      district: projectDistrict,
    },
    bid.durationDays,
    projectContractTerms,
  );
}

export function ClientCommercialProposalPanel({
  projectId,
  bid,
  projectTitle,
  projectDistrict,
  projectContractTerms,
  readOnly = false,
  onBidUpdated,
}: ClientCommercialProposalPanelProps) {
  const [contractTerms, setContractTerms] = useState<BidContractTerms>(() =>
    buildContractTermsState(
      bid,
      projectTitle,
      projectDistrict,
      projectContractTerms,
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setContractTerms(
      buildContractTermsState(
        bid,
        projectTitle,
        projectDistrict,
        projectContractTerms,
      ),
    );
  }, [bid, projectTitle, projectDistrict, projectContractTerms]);

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
        {readOnly
          ? 'Commercial proposal terms agreed for this bid, including employer details.'
          : 'Adjust site details and propose payment, schedule, and special conditions. Contractor proposal fields are read-only.'}
      </p>

      <BidContractTermsFields
        value={contractTerms}
        onChange={setContractTerms}
        audience="client"
        projectTitle={projectTitle}
        projectDistrict={projectDistrict}
        disabled={busy || readOnly}
      />

      {!readOnly && (
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
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
