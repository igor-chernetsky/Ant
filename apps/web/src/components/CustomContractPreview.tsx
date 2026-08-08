'use client';

import { useTranslation } from '@/components/LocaleProvider';
import { BusyLabel } from '@/components/AntSpinner';
import { CustomFileFormatPicker } from '@/components/CustomFileFormatPicker';
import {
  customFileCanPreviewPdf,
  customFileHasBothFormats,
  downloadCustomContractFile,
  type CustomFileDownloadFormat,
  type ProjectContract,
} from '@/lib/contracts';
import { formatDateTime } from '@/lib/projects';
import { useState } from 'react';

interface CustomContractPreviewProps {
  projectId: string;
  contract: ProjectContract;
  asContractor?: boolean;
}

function SignatureSlot({
  roleLabel,
  signedAt,
  signatureDataUrl,
  awaitingLabel,
  signedAtLabel,
  emptyLabel,
  imageAlt,
}: {
  roleLabel: string;
  signedAt: string | null;
  signatureDataUrl: string | null;
  awaitingLabel: string;
  signedAtLabel: string;
  emptyLabel: string;
  imageAlt: string;
}) {
  const showImage = Boolean(signedAt && signatureDataUrl);

  return (
    <div
      className={`contract-custom-signature-slot${
        signedAt ? ' contract-custom-signature-slot--signed' : ''
      }`}
    >
      <div className="contract-custom-signature-slot-head">
        <strong>{roleLabel}</strong>
        <span className="muted">
          {signedAt ? signedAtLabel : awaitingLabel}
        </span>
      </div>
      <div className="contract-custom-signature-slot-pad">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signatureDataUrl!}
            alt={imageAlt}
            className="contract-custom-signature-image"
          />
        ) : (
          <span className="muted contract-custom-signature-empty">
            {emptyLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function CustomContractPreview({
  projectId,
  contract,
  asContractor = false,
}: CustomContractPreviewProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formats, setFormats] = useState<CustomFileDownloadFormat[]>([
    'pdf',
    'docx',
  ]);
  const [includeSignatures, setIncludeSignatures] = useState(false);

  const file = contract.customFile;
  if (!contract.hasCustomContract || !file) {
    return null;
  }

  const canPreviewPdf = customFileCanPreviewPdf(file);
  const bothFormats = customFileHasBothFormats(file);

  const previewSrc = asContractor
    ? `/api/contractor/projects/${encodeURIComponent(projectId)}/contract/custom-file/preview`
    : `/api/projects/${encodeURIComponent(projectId)}/contract/custom-file/preview`;

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      const selectedFormats = bothFormats ? formats : undefined;
      const downloadingPdf =
        !selectedFormats || selectedFormats.includes('pdf');
      await downloadCustomContractFile(projectId, {
        asContractor,
        formats: selectedFormats,
        includeSignatures: includeSignatures && downloadingPdf,
      });
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

  return (
    <details className="contract-secondary-details" open>
      <summary className="contract-secondary-details-summary">
        {t('contractPanel.customPreviewToggle')}
      </summary>
      <div className="contract-secondary-details-body">
        <p className="muted contract-document-editor-hint">
          {canPreviewPdf
            ? t('contractPanel.customPreviewHint')
            : t('contractPanel.customPreviewLegacyDocxHint')}
        </p>
        <p className="muted contract-custom-preview-meta">
          {t('contractPanel.customFileLabel', { name: file.originalName })}
        </p>

        {canPreviewPdf ? (
          <div className="contract-custom-preview-frame-wrap">
            <iframe
              className="contract-custom-preview-frame"
              title={t('contractPanel.customPreviewFrameTitle')}
              src={previewSrc}
            />
          </div>
        ) : (
          <div className="contract-custom-preview-fallback">
            <p className="muted">{t('contractPanel.customPreviewLegacyDocxBody')}</p>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void handleDownload()}
            >
              <BusyLabel
                busy={busy}
                idle={t('contractPanel.downloadCustomContract')}
                busyText={t('contractPanel.downloadingCustom')}
              />
            </button>
          </div>
        )}

        <section
          className="contract-custom-signatures"
          aria-label={t('contractPanel.customSignaturesTitle')}
        >
          <h3 className="contract-custom-signatures-title">
            {t('contractPanel.customSignaturesTitle')}
          </h3>
          <p className="muted contract-custom-signatures-hint">
            {t('contractPanel.customSignaturesHint')}
          </p>
          <div className="contract-custom-signatures-grid">
            <SignatureSlot
              roleLabel={t('contractPanel.partyClient')}
              signedAt={contract.clientSignedAt}
              signatureDataUrl={contract.clientSignatureDataUrl ?? null}
              awaitingLabel={t('contractPanel.awaiting')}
              signedAtLabel={
                contract.clientSignedAt
                  ? t('contractPanel.signedAt', {
                      date: formatDateTime(contract.clientSignedAt),
                    })
                  : ''
              }
              emptyLabel={
                contract.clientSignedAt
                  ? t('contractPanel.signatureAckOnly')
                  : t('contractPanel.signaturePending')
              }
              imageAlt={t('contractPanel.clientSignatureAlt')}
            />
            <SignatureSlot
              roleLabel={t('contractPanel.partyContractor')}
              signedAt={contract.contractorSignedAt}
              signatureDataUrl={contract.contractorSignatureDataUrl ?? null}
              awaitingLabel={t('contractPanel.awaiting')}
              signedAtLabel={
                contract.contractorSignedAt
                  ? t('contractPanel.signedAt', {
                      date: formatDateTime(contract.contractorSignedAt),
                    })
                  : ''
              }
              emptyLabel={
                contract.contractorSignedAt
                  ? t('contractPanel.signatureAckOnly')
                  : t('contractPanel.signaturePending')
              }
              imageAlt={t('contractPanel.contractorSignatureAlt')}
            />
          </div>
          {canPreviewPdf && (
            <label className="contract-include-signatures">
              <input
                type="checkbox"
                checked={includeSignatures}
                disabled={busy}
                onChange={(e) => setIncludeSignatures(e.target.checked)}
              />
              <span>{t('contractPanel.includeSignaturesInPdf')}</span>
            </label>
          )}
        </section>

        {canPreviewPdf && (
          <div className="contract-custom-preview-actions">
            <CustomFileFormatPicker
              hasPdf={Boolean(file.hasPdf)}
              hasDocx={Boolean(file.hasDocx)}
              formats={formats}
              onChange={setFormats}
              disabled={busy}
            />
            <button
              type="button"
              className="secondary"
              disabled={busy || (bothFormats && formats.length === 0)}
              aria-busy={busy}
              onClick={() => void handleDownload()}
            >
              <BusyLabel
                busy={busy}
                idle={t('contractPanel.downloadCustomContract')}
                busyText={t('contractPanel.downloadingCustom')}
              />
            </button>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
      </div>
    </details>
  );
}
