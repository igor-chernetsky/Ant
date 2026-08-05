'use client';

import { useTranslation } from '@/components/LocaleProvider';
import { BusyLabel } from '@/components/AntSpinner';
import {
  downloadCustomContractFile,
  type ProjectContract,
} from '@/lib/contracts';
import { useState } from 'react';

interface CustomContractPreviewProps {
  projectId: string;
  contract: ProjectContract;
  asContractor?: boolean;
}

function isPdfContentType(contentType: string | null | undefined): boolean {
  return (contentType ?? '').toLowerCase().includes('pdf');
}

function isPdfFileName(name: string | null | undefined): boolean {
  return (name ?? '').toLowerCase().endsWith('.pdf');
}

export function CustomContractPreview({
  projectId,
  contract,
  asContractor = false,
}: CustomContractPreviewProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const file = contract.customFile;
  if (!contract.hasCustomContract || !file) {
    return null;
  }

  const canPreviewPdf =
    isPdfContentType(file.contentType) || isPdfFileName(file.originalName);

  const previewSrc = asContractor
    ? `/api/contractor/projects/${encodeURIComponent(projectId)}/contract/custom-file/preview`
    : `/api/projects/${encodeURIComponent(projectId)}/contract/custom-file/preview`;

  const handleDownload = async () => {
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

  return (
    <details className="contract-secondary-details" open>
      <summary className="contract-secondary-details-summary">
        {t('contractPanel.customPreviewToggle')}
      </summary>
      <div className="contract-secondary-details-body">
        <p className="muted contract-document-editor-hint">
          {canPreviewPdf
            ? t('contractPanel.customPreviewHint')
            : t('contractPanel.customPreviewDocxHint')}
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
            <p className="muted">{t('contractPanel.customPreviewDocxBody')}</p>
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

        {canPreviewPdf && (
          <div className="contract-custom-preview-actions">
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
            <a
              className="text-link"
              href={previewSrc}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('contractPanel.openCustomPreviewTab')}
            </a>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
      </div>
    </details>
  );
}
