'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchProjectContract,
  signProjectContract,
  type ProjectContract,
} from '@/lib/contracts';
import { CommercialProposalDownload } from '@/components/CommercialProposalDownload';
import { ContractSigningPartiesInline } from '@/components/ContractSigningPartiesInline';
import { ContractSigningStatusPill } from '@/components/ContractSigningStatusPill';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface ContractSigningPanelProps {
  projectId: string;
  bidId: string;
  asContractor?: boolean;
  hideHeading?: boolean;
  contract?: ProjectContract | null;
  onSigned?: (contract: ProjectContract) => void;
}

export function ContractSigningPanel({
  projectId,
  bidId,
  asContractor = false,
  hideHeading = false,
  contract: contractProp = null,
  onSigned,
}: ContractSigningPanelProps) {
  const [contract, setContract] = useState<ProjectContract | null>(contractProp);
  const [loading, setLoading] = useState(!contractProp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

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
    setContract(contractProp);
    if (contractProp) {
      setLoading(false);
      return;
    }
    void loadContract();
  }, [contractProp, loadContract]);

  const handleSign = async () => {
    const confirmed = await confirm({
      title: 'Sign contract',
      message:
        'This records your acceptance on the platform. The other party will be notified to sign as well.',
      confirmLabel: 'Sign contract',
    });
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
        <div className="contract-signing-heading-row">
          <h4 className="tender-subsection-title">Contract signing</h4>
          <ContractSigningStatusPill contract={contract} />
        </div>
      )}

      {!hideHeading && (
        <p className="muted contract-signing-hint">
          Both parties must sign the contract draft before the project becomes
          active.
        </p>
      )}

      <ContractSigningPartiesInline contract={contract} />

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
      {confirmDialog}
    </div>
  );
}
