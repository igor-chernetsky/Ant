'use client';

import { useTranslation } from '@/components/LocaleProvider';
import { usePlatformFeeTrial } from '@/hooks/usePlatformFeeTrial';
import {
  buildPlatformFeeQuote,
  formatPlatformMoney,
  formatTrialEndDate,
  formatUsd,
} from '@/lib/platform-fees';

interface PlatformFeeSummaryProps {
  contractAmount?: number | string | null;
  currency?: string | null;
  compact?: boolean;
}

/** Always-visible fee breakdown for the contractor (listed amounts; trial = $0 due). */
export function PlatformFeeSummary({
  contractAmount,
  currency,
  compact = false,
}: PlatformFeeSummaryProps) {
  const { t, locale } = useTranslation();
  const trial = usePlatformFeeTrial();
  const quote = buildPlatformFeeQuote({ contractAmount, currency, trial });

  const remaining =
    quote.successFeeRemaining != null
      ? formatPlatformMoney(
          quote.successFeeRemaining,
          quote.currency,
          locale,
        )
      : t('common.dash');
  const successGross =
    quote.successFeeGross != null
      ? formatPlatformMoney(quote.successFeeGross, quote.currency, locale)
      : t('common.dash');

  return (
    <aside
      className={`platform-fee-summary${compact ? ' platform-fee-summary--compact' : ''}`}
    >
      <div className="platform-fee-summary-header">
        <h4 className="platform-fee-summary-title">
          {t('platformFees.summaryTitle')}
        </h4>
        {quote.trialActive && (
          <span className="platform-fee-trial-pill">
            {t('platformFees.trialPill')}
          </span>
        )}
      </div>
      <p className="muted platform-fee-summary-lead">
        {quote.trialActive
          ? t('platformFees.summaryLead')
          : t('platformFees.summaryLeadPaid')}
      </p>
      {quote.trialActive && quote.trialEndsAt ? (
        <p className="muted platform-fee-summary-lead">
          {t('platformFees.trialEndsOn', {
            date: formatTrialEndDate(quote.trialEndsAt, locale),
          })}
        </p>
      ) : null}
      <ul className="platform-fee-summary-list">
        <li>
          {t('platformFees.summaryAccess', {
            usd: formatUsd(quote.accessFeeUsd, locale),
            local: formatPlatformMoney(
              quote.dueNowListed,
              quote.currency,
              locale,
            ),
          })}
        </li>
        <li>
          {t('platformFees.summarySuccess', {
            percent: 2,
            amount: successGross,
          })}
        </li>
        <li>
          {t('platformFees.summaryRemaining', { amount: remaining })}
        </li>
        <li className="platform-fee-summary-due">
          {quote.trialActive
            ? t('platformFees.summaryDueNow', {
                amount: formatPlatformMoney(0, quote.currency, locale),
              })
            : t('platformFees.summaryDueNowListed', {
                amount: formatPlatformMoney(
                  quote.dueNowListed,
                  quote.currency,
                  locale,
                ),
              })}
        </li>
      </ul>
    </aside>
  );
}
