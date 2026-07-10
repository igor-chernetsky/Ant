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
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';

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
  const { t } = useTranslation();
  const { getContractSigningMessage } = useAppFormatters();
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
      setError(
        err instanceof Error ? err.message : t('contractPanel.loadFailed'),
      );
      setContract(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, asContractor, t]);

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
      title: t('confirm.signContractTitle'),
      message: t('confirm.signContractMessage'),
      confirmLabel: t('confirm.signContractLabel'),
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const updated = await signProjectContract(projectId, { asContractor });
      setContract(updated);
      onSigned?.(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('contractPanel.signFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="muted">{t('contractPanel.loading')}</p>;
  }

  if (!contract) {
    return null;
  }

  const signingStatus = contract.fullySigned
    ? 'fully_signed'
    : contract.clientSignedAt && !contract.contractorSignedAt
      ? 'awaiting_contractor'
      : !contract.clientSignedAt && contract.contractorSignedAt
        ? 'awaiting_client'
        : 'awaiting_both';

  return (
    <div className="contract-signing-panel">
      {!hideHeading && (
        <div className="contract-signing-heading-row">
          <h4 className="tender-subsection-title">
            {t('contractPanel.signingTitle')}
          </h4>
          <ContractSigningStatusPill contract={contract} />
        </div>
      )}

      {!hideHeading && (
        <p className="muted contract-signing-hint">
          {t('contractPanel.signingHint')}
        </p>
      )}

      <ContractSigningPartiesInline contract={contract} />

      <div className="contract-signing-actions-wrap">
        <div className="participation-toolbar contract-signing-toolbar">
          <CommercialProposalDownload
            bidId={bidId}
            projectId={asContractor ? undefined : projectId}
            label={t('commercialProposal.downloadDraft')}
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
              {busy
                ? t('contractPanel.signing')
                : t('contractPanel.signContract')}
            </button>
          )}
        </div>
      </div>

      {contract.fullySigned && (
        <p className="contract-signing-complete muted">
          {getContractSigningMessage(signingStatus)}
        </p>
      )}

      {error && <p className="form-error">{error}</p>}
      {confirmDialog}
    </div>
  );
}
