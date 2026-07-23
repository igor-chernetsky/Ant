'use client';

import { FormEvent, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  BID_WITHDRAWAL_REASON_CODES,
  type BidWithdrawalReasonCode,
} from '@/lib/tendering';
import type { MessageKey } from '@/lib/i18n';

const DECLINE_REASON_MESSAGE_KEYS: Record<
  BidWithdrawalReasonCode,
  MessageKey
> = {
  specialization_mismatch: 'contractor.declineReasonSpecializationMismatch',
  incomplete_information: 'contractor.declineReasonIncompleteInformation',
  capacity_insufficient: 'contractor.declineReasonCapacityInsufficient',
  commercial_terms_unacceptable:
    'contractor.declineReasonCommercialTermsUnacceptable',
  other: 'contractor.declineReasonOther',
};

interface DeclineProposalDialogProps {
  isOpen: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (input: {
    reasonCode: BidWithdrawalReasonCode;
    reasonNote?: string;
  }) => Promise<void> | void;
}

export function DeclineProposalDialog({
  isOpen,
  busy = false,
  onCancel,
  onConfirm,
}: DeclineProposalDialogProps) {
  const { t } = useTranslation();
  const [reasonCode, setReasonCode] =
    useState<BidWithdrawalReasonCode>('specialization_mismatch');
  const [reasonNote, setReasonNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (reasonCode === 'other' && reasonNote.trim().length < 3) {
      setError(t('contractor.declineProposalOtherRequired'));
      return;
    }
    try {
      await onConfirm({
        reasonCode,
        reasonNote:
          reasonCode === 'other' || reasonNote.trim()
            ? reasonNote.trim()
            : undefined,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('contractor.declineProposalFailed'),
      );
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div
        className="modal decline-proposal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="decline-proposal-title"
      >
        <div className="modal-header">
          <h2 id="decline-proposal-title">
            {t('contractor.declineProposalTitle')}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('common.close')}
            onClick={onCancel}
            disabled={busy}
          >
            ×
          </button>
        </div>
        <p className="muted modal-subtitle">
          {t('contractor.declineProposalHint')}
        </p>

        <form className="modal-form" onSubmit={(e) => void handleSubmit(e)}>
          <fieldset className="decline-proposal-reasons">
            <legend>{t('contractor.declineProposalReasonLegend')}</legend>
            {BID_WITHDRAWAL_REASON_CODES.map((code) => (
              <label
                key={code}
                className="checkbox-label decline-proposal-option"
              >
                <input
                  type="radio"
                  name="decline-reason"
                  value={code}
                  checked={reasonCode === code}
                  onChange={() => setReasonCode(code)}
                  disabled={busy}
                />
                <span>{t(DECLINE_REASON_MESSAGE_KEYS[code])}</span>
              </label>
            ))}
          </fieldset>

          {reasonCode === 'other' && (
            <label>
              {t('contractor.declineProposalOtherLabel')}
              <textarea
                value={reasonNote}
                onChange={(event) => setReasonNote(event.target.value)}
                rows={3}
                maxLength={1000}
                required
                disabled={busy}
                placeholder={t('contractor.declineProposalOtherPlaceholder')}
              />
            </label>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="confirm-dialog-actions">
            <button
              type="button"
              className="secondary"
              onClick={onCancel}
              disabled={busy}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy
                ? t('contractor.decliningProposal')
                : t('contractor.declineProposalConfirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function formatBidWithdrawalReason(
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  reasonCode: BidWithdrawalReasonCode | null | undefined,
  reasonNote?: string | null,
): string | null {
  if (!reasonCode) return null;
  if (reasonCode === 'other') {
    return reasonNote?.trim() || t(DECLINE_REASON_MESSAGE_KEYS.other);
  }
  return t(DECLINE_REASON_MESSAGE_KEYS[reasonCode]);
}
