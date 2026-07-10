'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  downloadCommercialProposal,
  fetchCommercialProposalAttachmentCount,
} from '@/lib/tendering';

interface CommercialProposalDownloadProps {
  bidId: string;
  projectId?: string;
  label?: string;
  className?: string;
  /** Renders button inline inside a toolbar (no block wrapper spacing). */
  inline?: boolean;
}

export function CommercialProposalDownload({
  bidId,
  projectId,
  label,
  className = 'secondary',
  inline = false,
}: CommercialProposalDownloadProps) {
  const { t } = useTranslation();
  const downloadLabel = label ?? t('commercialProposal.downloadDraft');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [withAttachments, setWithAttachments] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const count = await fetchCommercialProposalAttachmentCount(
          bidId,
          projectId,
        );
        if (!cancelled) {
          setAttachmentCount(count);
          setWithAttachments(count > 0);
        }
      } catch {
        if (!cancelled) {
          setAttachmentCount(0);
          setWithAttachments(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bidId, projectId]);

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadCommercialProposal(bidId, projectId, {
        withAttachments: withAttachments && attachmentCount > 0,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('commercialProposal.downloadFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const checkbox = attachmentCount > 0 && (
    <label className="commercial-proposal-download-option">
      <input
        type="checkbox"
        checked={withAttachments}
        onChange={(event) => setWithAttachments(event.target.checked)}
        disabled={busy}
      />
      <span>
        {t('commercialProposal.includeAttachments', {
          count: attachmentCount,
          documents:
            attachmentCount === 1
              ? t('commercialProposal.document_one')
              : t('commercialProposal.document_other'),
        })}
      </span>
    </label>
  );

  const button = (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={() => void handleDownload()}
    >
      {busy ? t('commercialProposal.preparing') : downloadLabel}
    </button>
  );

  if (inline) {
    return (
      <>
        <div className="commercial-proposal-download-inline">
          {button}
          {checkbox}
        </div>
        {error && (
          <p className="form-error contract-signing-inline-error">{error}</p>
        )}
      </>
    );
  }

  return (
    <div className="commercial-proposal-download">
      {button}
      {checkbox}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
