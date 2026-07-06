'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchProjectContract,
  signProjectContract,
  type ProjectContract,
} from '@/lib/contracts';
import { formatDateTime } from '@/lib/projects';
import { CommercialProposalDownload } from '@/components/CommercialProposalDownload';

interface ContractSigningPanelProps {
  projectId: string;
  bidId: string;
  asContractor?: boolean;
  hideHeading?: boolean;
  onSigned?: (contract: ProjectContract) => void;
}

export function ContractSigningPanel({
  projectId,
  bidId,
  asContractor = false,
  hideHeading = false,
  onSigned,
}: ContractSigningPanelProps) {
  const [contract, setContract] = useState<ProjectContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContract = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectContract(projectId, { asContractor });
      setContract(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contract');
      setContract(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, asContractor]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  const handleSign = async () => {
    const confirmed = window.confirm(
      'Sign this contract? This records your acceptance on the platform.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const updated = await signProjectContract(projectId, { asContractor });
      setContract(updated);
      onSigned?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign contract');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="muted">Loading contract…</p>;
  }

  if (!contract) {
    return null;
  }

  return (
    <div className="contract-signing-panel">
      {!hideHeading && (
        <h4 className="tender-subsection-title">Contract signing</h4>
      )}
      {!hideHeading && (
        <p className="muted contract-signing-hint">
          Both the client and the selected contractor must sign the contract draft
          before the project becomes active.
        </p>
      )}

      <dl className="meta-grid contract-signing-meta">
        <div>
          <dt>Client</dt>
          <dd>
            {contract.clientSignedAt
              ? `Signed ${formatDateTime(contract.clientSignedAt)}`
              : 'Awaiting signature'}
          </dd>
        </div>
        <div>
          <dt>Contractor</dt>
          <dd>
            {contract.contractorSignedAt
              ? `Signed ${formatDateTime(contract.contractorSignedAt)}`
              : 'Awaiting signature'}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            {contract.fullySigned
              ? 'Fully signed — project active'
              : 'Awaiting signatures'}
          </dd>
        </div>
      </dl>

      <div className="contract-signing-actions-wrap">
        <div className="participation-toolbar contract-signing-toolbar">
          <CommercialProposalDownload
            bidId={bidId}
            projectId={asContractor ? undefined : projectId}
            label="Download contract draft"
            className="secondary"
            inline
          />
          {contract.canSign && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void handleSign()}
            >
              {busy ? 'Signing…' : 'Sign contract'}
            </button>
          )}
        </div>
      </div>

      {contract.fullySigned && (
        <p className="contract-signing-complete muted">
          Both parties have signed. The project is now active.
        </p>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
