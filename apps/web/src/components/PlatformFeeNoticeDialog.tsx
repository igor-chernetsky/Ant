'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  formatPlatformMoney,
  formatUsd,
  type PlatformFeeNoticeStep,
  type PlatformFeeQuote,
} from '@/lib/platform-fees';

export interface PlatformFeeNoticeDialogProps {
  isOpen: boolean;
  quote: PlatformFeeQuote | null;
  step: PlatformFeeNoticeStep;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PlatformFeeNoticeDialog({
  isOpen,
  quote,
  step,
  busy = false,
  onConfirm,
  onCancel,
}: PlatformFeeNoticeDialogProps) {
  const { t, locale } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, busy, onCancel]);

  if (!isOpen || !quote) {
    return null;
  }

  const title =
    step === 'award'
      ? t('platformFees.awardTitle')
      : t('platformFees.signTitle');
  const intro =
    step === 'award'
      ? t('platformFees.awardIntro')
      : t('platformFees.signIntro');

  const accessLocal =
    quote.accessFeeInCurrency != null
      ? formatPlatformMoney(
          quote.accessFeeInCurrency,
          quote.currency,
          locale,
        )
      : null;
  const successGross =
    quote.successFeeGross != null
      ? formatPlatformMoney(quote.successFeeGross, quote.currency, locale)
      : t('common.dash');
  const credit =
    quote.accessFeeCredit != null
      ? formatPlatformMoney(quote.accessFeeCredit, quote.currency, locale)
      : formatUsd(quote.accessFeeUsd, locale);
  const remaining =
    quote.successFeeRemaining != null
      ? formatPlatformMoney(
          quote.successFeeRemaining,
          quote.currency,
          locale,
        )
      : t('platformFees.successFeePendingAmount');

  return (
    <div
      className="modal-backdrop confirm-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="modal confirm-dialog platform-fee-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="platform-fee-dialog-title"
        aria-describedby="platform-fee-dialog-intro"
      >
        <div className="confirm-dialog-body">
          <h2 id="platform-fee-dialog-title" className="confirm-dialog-title">
            {title}
          </h2>
          {quote.trialActive && (
            <p className="platform-fee-trial-badge">
              {t('platformFees.trialBadge', {
                percent: quote.trialDiscountPercent,
              })}
            </p>
          )}
          <p id="platform-fee-dialog-intro" className="confirm-dialog-message">
            {intro}
          </p>

          <dl className="platform-fee-breakdown">
            <div>
              <dt>{t('platformFees.accessFeeLabel')}</dt>
              <dd>
                {formatUsd(quote.accessFeeUsd, locale)}
                {accessLocal ? ` ≈ ${accessLocal}` : ''}
              </dd>
            </div>
            <div>
              <dt>{t('platformFees.successFeeLabel')}</dt>
              <dd>
                {t('platformFees.successFeeValue', {
                  percent: 2,
                  amount: successGross,
                })}
              </dd>
            </div>
            <div>
              <dt>{t('platformFees.creditLabel')}</dt>
              <dd>{credit}</dd>
            </div>
            <div>
              <dt>{t('platformFees.remainingLabel')}</dt>
              <dd>{remaining}</dd>
            </div>
            <div className="platform-fee-breakdown-due">
              <dt>{t('platformFees.dueNowLabel')}</dt>
              <dd>
                {quote.trialActive
                  ? t('platformFees.dueNowTrial', {
                      listed:
                        accessLocal ??
                        formatUsd(quote.accessFeeUsd, locale),
                      payable: formatPlatformMoney(
                        0,
                        quote.currency,
                        locale,
                      ),
                    })
                  : accessLocal ?? formatUsd(quote.accessFeeUsd, locale)}
              </dd>
            </div>
          </dl>

          <p className="muted platform-fee-footnote">
            {t('platformFees.timingNote')}
          </p>
          {quote.currency === 'THB' && (
            <p className="muted platform-fee-footnote">
              {t('platformFees.fxNote', {
                rate: quote.indicativeUsdThbRate,
              })}
            </p>
          )}
          <p className="muted platform-fee-footnote">
            {t('platformFees.payerNote')}
          </p>
        </div>

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy
              ? t('common.pleaseWait')
              : quote.trialActive
                ? t('platformFees.continueTrial')
                : t('platformFees.continuePaid')}
          </button>
        </div>
      </div>
    </div>
  );
}
