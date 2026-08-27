'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/components/LocaleProvider';
import {
  formatPlatformMoney,
  formatUsd,
  type PlatformFeeQuote,
} from '@/lib/platform-fees';

export type PlatformFeeDialogMode =
  | 'request'
  | 'pending'
  | 'bank_required'
  | 'request_sent';

export interface PlatformFeeNoticeDialogProps {
  isOpen: boolean;
  mode: PlatformFeeDialogMode;
  quote: PlatformFeeQuote | null;
  busy?: boolean;
  error?: string | null;
  rejectionReason?: string | null;
  profileHref?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function portalDialog(node: ReactNode) {
  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}

export function PlatformFeeNoticeDialog({
  isOpen,
  mode,
  quote,
  busy = false,
  error = null,
  rejectionReason = null,
  profileHref = '/contractor',
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

  if (!isOpen) {
    return null;
  }

  if (mode === 'bank_required') {
    return portalDialog(
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
        >
          <div className="confirm-dialog-body">
            <h2 id="platform-fee-dialog-title" className="confirm-dialog-title">
              {t('platformFees.bankRequiredTitle')}
            </h2>
            <p className="confirm-dialog-message">
              {t('platformFees.bankRequiredMessage')}
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
            <Link href={profileHref} className="primary">
              {t('platformFees.goToProfile')}
            </Link>
          </div>
        </div>
      </div>,
    );
  }

  if (mode === 'pending' || mode === 'request_sent') {
    return portalDialog(
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
        >
          <div className="confirm-dialog-body">
            <h2 id="platform-fee-dialog-title" className="confirm-dialog-title">
              {mode === 'request_sent'
                ? t('platformFees.requestSentTitle')
                : t('platformFees.pendingTitle')}
            </h2>
            <p className="confirm-dialog-message">
              {mode === 'request_sent'
                ? t('platformFees.requestSentMessage')
                : t('platformFees.pendingMessage')}
            </p>
          </div>
          <div className="confirm-dialog-actions">
            <button type="button" className="primary" onClick={onCancel}>
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>,
    );
  }

  if (!quote) {
    return null;
  }

  const dueListed = formatPlatformMoney(
    quote.dueNowListed,
    quote.currency,
    locale,
  );
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

  return portalDialog(
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
            {t('platformFees.signTitle')}
          </h2>
          {quote.trialActive && (
            <p className="platform-fee-trial-badge">
              {t('platformFees.trialBadge', {
                percent: quote.trialDiscountPercent,
              })}
            </p>
          )}
          <p id="platform-fee-dialog-intro" className="confirm-dialog-message">
            {t('platformFees.signIntro')}
          </p>
          {rejectionReason ? (
            <p className="confirm-dialog-message platform-fee-rejection">
              {t('platformFees.rejectionNote', { reason: rejectionReason })}
            </p>
          ) : null}

          <dl className="platform-fee-breakdown">
            <div>
              <dt>{t('platformFees.accessFeeLabel')}</dt>
              <dd>
                {t('platformFees.accessFeeValue', {
                  usd: formatUsd(quote.accessFeeUsd, locale),
                  due: dueListed,
                })}
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
                      listed: dueListed,
                      payable: formatPlatformMoney(
                        0,
                        quote.currency,
                        locale,
                      ),
                    })
                  : dueListed}
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
            {t('platformFees.requestNote')}
          </p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
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
              : t('platformFees.submitRequest')}
          </button>
        </div>
      </div>
    </div>,
  );
}
