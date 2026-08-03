'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  downloadCustomContractFile,
  fetchProjectContract,
  signProjectContract,
  uploadCustomContractFile,
  type ProjectContract,
} from '@/lib/contracts';
import { CommercialProposalDownload } from '@/components/CommercialProposalDownload';
import { AntSpinner, BusyLabel } from '@/components/AntSpinner';
import {
  ContractSignaturePad,
  type ContractSignaturePadHandle,
} from '@/components/ContractSignaturePad';
import { ContractSigningPartiesInline } from '@/components/ContractSigningPartiesInline';
import { ContractSigningStatusPill } from '@/components/ContractSigningStatusPill';
import { PlatformFeeSummary } from '@/components/PlatformFeeSummary';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { usePlatformFeeNotice } from '@/hooks/usePlatformFeeNotice';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { releaseAwardedContractor } from '@/lib/tendering';

interface ContractSigningPanelProps {
  projectId: string;
  bidId: string;
  asContractor?: boolean;
  hideHeading?: boolean;
  contract?: ProjectContract | null;
  /** Awarded bid amount — used to show listed platform fees for the contractor. */
  bidAmount?: number | string | null;
  currency?: string | null;
  onSigned?: (contract: ProjectContract) => void;
  onAwardReleased?: () => void;
}

export function ContractSigningPanel({
  projectId,
  bidId,
  asContractor = false,
  hideHeading = false,
  contract: contractProp = null,
  bidAmount = null,
  currency = 'THB',
  onSigned,
  onAwardReleased,
}: ContractSigningPanelProps) {
  const { t } = useTranslation();
  const { getContractSigningMessage } = useAppFormatters();
  const [contract, setContract] = useState<ProjectContract | null>(contractProp);
  const [loading, setLoading] = useState(!contractProp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const signaturePadRef = useRef<ContractSignaturePadHandle | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { acknowledgePlatformFees, dialog: feeDialog } = usePlatformFeeNotice();

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
    if (asContractor) {
      const feesOk = await acknowledgePlatformFees({
        step: 'sign',
        contractAmount: bidAmount,
        currency,
      });
      if (!feesOk) return;
    }

    const confirmed = await confirm({
      title: t('confirm.signContractTitle'),
      message: t('confirm.signContractMessage'),
      confirmLabel: t('confirm.signContractLabel'),
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const signatureDataUrl = contract?.hasCustomContract
        ? null
        : (signaturePadRef.current?.toDataURL() ?? null);
      const updated = await signProjectContract(projectId, {
        asContractor,
        signatureDataUrl,
      });
      setContract(updated);
      signaturePadRef.current?.clear();
      onSigned?.(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('contractPanel.signFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReleaseAward = async () => {
    const confirmed = await confirm({
      title: t('confirm.releaseAwardTitle'),
      message: t('confirm.releaseAwardMessage'),
      confirmLabel: t('confirm.releaseAwardLabel'),
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await releaseAwardedContractor(projectId);
      setContract(null);
      onAwardReleased?.();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('contractPanel.releaseFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCustomFileSelected = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (contract?.clientSignedAt || contract?.contractorSignedAt) {
      const confirmed = await confirm({
        title: t('confirm.replaceCustomContractTitle'),
        message: t('confirm.replaceCustomContractMessage'),
        confirmLabel: t('confirm.replaceCustomContractLabel'),
      });
      if (!confirmed) return;
    }

    setBusy(true);
    setError(null);
    try {
      const updated = await uploadCustomContractFile(projectId, file, {
        asContractor,
      });
      setContract(updated);
      onSigned?.(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('contractPanel.customUploadFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadCustom = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadCustomContractFile(projectId, { asContractor });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('contractPanel.customDownloadFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <p className="muted contract-signing-loading">
        <AntSpinner size="md" label={t('contractPanel.loading')} />
        <span>{t('contractPanel.loading')}</span>
      </p>
    );
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

  const hasCustom = Boolean(contract.hasCustomContract);

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
          {hasCustom
            ? t('contractPanel.customSigningHint')
            : t('contractPanel.signingHint')}
        </p>
      )}

      <ContractSigningPartiesInline contract={contract} />

      {asContractor && !contract.fullySigned && (
        <PlatformFeeSummary
          contractAmount={bidAmount}
          currency={currency}
          compact
        />
      )}

      {!asContractor && !contract.fullySigned && (
        <p className="muted platform-fee-contractor-note">
          {t('platformFees.clientNote')}
        </p>
      )}

      {contract.canSign && !hasCustom && (
        <ContractSignaturePad padRef={signaturePadRef} disabled={busy} />
      )}

      <div className="contract-signing-download">
        {hasCustom ? (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void handleDownloadCustom()}
          >
            <BusyLabel
              busy={busy}
              idle={t('contractPanel.downloadCustomContract')}
              busyText={t('contractPanel.downloadingCustom')}
            />
          </button>
        ) : (
          <CommercialProposalDownload
            bidId={bidId}
            projectId={asContractor ? undefined : projectId}
            label={
              contract.fullySigned
                ? t('commercialProposal.downloadSigned')
                : t('commercialProposal.downloadDraft')
            }
            className="secondary"
            embedded
          />
        )}
      </div>

      {hasCustom && contract.customFile && (
        <p className="muted contract-custom-file-name">
          {t('contractPanel.customFileLabel', {
            name: contract.customFile.originalName,
          })}
        </p>
      )}

      {!contract.fullySigned && (
        <div className="contract-signing-actions">
          {contract.canSign && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void handleSign()}
            >
              <BusyLabel
                busy={busy}
                idle={t('contractPanel.signContract')}
                busyText={t('contractPanel.signing')}
              />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(event) => void handleCustomFileSelected(event)}
          />
          <button
            type="button"
            className="secondary"
            disabled={busy}
            aria-busy={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <BusyLabel
              busy={busy}
              idle={
                hasCustom
                  ? t('contractPanel.replaceCustomContract')
                  : t('contractPanel.uploadCustomContract')
              }
              busyText={t('contractPanel.uploadingCustom')}
            />
          </button>
          {!asContractor && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void handleReleaseAward()}
            >
              {t('contractPanel.releaseContractor')}
            </button>
          )}
        </div>
      )}

      {contract.fullySigned && (
        <p className="contract-signing-complete muted">
          {getContractSigningMessage(signingStatus)}
        </p>
      )}

      {error && <p className="form-error">{error}</p>}
      {feeDialog}
      {confirmDialog}
    </div>
  );
}
