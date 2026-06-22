'use client';

import { useState } from 'react';
import { downloadCommercialProposal } from '@/lib/tendering';

interface CommercialProposalDownloadProps {
  bidId: string;
  projectId?: string;
  label?: string;
  className?: string;
}

export function CommercialProposalDownload({
  bidId,
  projectId,
  label = 'Download КП (HTML)',
  className = 'secondary',
}: CommercialProposalDownloadProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadCommercialProposal(bidId, projectId);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to download document',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="commercial-proposal-download">
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={() => void handleDownload()}
      >
        {busy ? 'Preparing…' : label}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
