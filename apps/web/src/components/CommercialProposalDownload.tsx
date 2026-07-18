'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/i18n';
import {
  downloadCommercialProposal,
  fetchCommercialProposalAttachmentCount,
} from '@/lib/tendering';

interface CommercialProposalDownloadProps {
  bidId: string;
  projectId?: string;
  label?: string;
  className?: string;
  /** Compact card layout for the contract signing panel. */
  embedded?: boolean;
}

export function CommercialProposalDownload({
  bidId,
  projectId,
  label,
  className = 'secondary',
  embedded = false,
}: CommercialProposalDownloadProps) {
  const { t, locale } = useTranslation();
  const downloadLabel = label ?? t('commercialProposal.downloadDraft');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [withAttachments, setWithAttachments] = useState(true);
  const [selectedLocales, setSelectedLocales] = useState<Locale[]>([locale]);

  useEffect(() => {
    setSelectedLocales((current) =>
      current.includes(locale) ? current : [locale, ...current],
    );
  }, [locale]);

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

  const toggleLocale = (next: Locale) => {
    setSelectedLocales((current) => {
      if (current.includes(next)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((value) => value !== next);
      }
      return [...current, next];
    });
  };

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadCommercialProposal(bidId, projectId, {
        withAttachments: withAttachments && attachmentCount > 0,
        locales: selectedLocales,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('commercialProposal.downloadFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        embedded
          ? 'commercial-proposal-download commercial-proposal-download--embedded'
          : 'commercial-proposal-download'
      }
    >
      <fieldset className="commercial-proposal-download-locales">
        <legend>{t('commercialProposal.downloadLanguages')}</legend>
        <div className="commercial-proposal-download-locale-list">
          {SUPPORTED_LOCALES.map((code) => {
            const checked = selectedLocales.includes(code);
            return (
              <label key={code} className="commercial-proposal-download-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleLocale(code)}
                  disabled={busy}
                />
                <span>{LOCALE_LABELS[code]}</span>
              </label>
            );
          })}
        </div>
        <p className="muted commercial-proposal-download-locales-hint">
          {selectedLocales.length > 1
            ? t('commercialProposal.multiLanguageHint')
            : t('commercialProposal.singleLanguageHint')}
        </p>
      </fieldset>

      {attachmentCount > 0 && (
        <label className="commercial-proposal-download-option commercial-proposal-download-attachments">
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
      )}

      <button
        type="button"
        className={className}
        disabled={busy || selectedLocales.length === 0}
        onClick={() => void handleDownload()}
      >
        {busy ? t('commercialProposal.preparing') : downloadLabel}
      </button>

      {error && (
        <p
          className={`form-error${
            embedded ? ' contract-signing-inline-error' : ''
          }`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
