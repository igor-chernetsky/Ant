'use client';

import { useTranslation } from '@/components/LocaleProvider';
import {
  buildPlatformFeeQuote,
  formatPlatformMoney,
  formatUsd,
} from '@/lib/platform-fees';

interface PlatformFeeSummaryProps {
  contractAmount?: number | string | null;
  currency?: string | null;
  compact?: boolean;
}

/** Always-visible fee breakdown for the client (listed amounts; trial = $0 due). */
export function PlatformFeeSummary({
  contractAmount,
  currency,
  compact = false,
}: PlatformFeeSummaryProps) {
  const { t, locale } = useTranslation();
  const quote = buildPlatformFeeQuote({ contractAmount, currency });

  const accessLocal =
    quote.accessFeeInCurrency != null
      ? formatPlatformMoney(
          quote.accessFeeInCurrency,
          quote.currency,
          locale,
        )
      : null;
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
        {t('platformFees.summaryLead')}
      </p>
      <ul className="platform-fee-summary-list">
        <li>
          {t('platformFees.summaryAccess', {
            usd: formatUsd(quote.accessFeeUsd, locale),
            local: accessLocal ?? formatUsd(quote.accessFeeUsd, locale),
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
          {t('platformFees.summaryDueNow', {
            amount: formatPlatformMoney(0, quote.currency, locale),
          })}
        </li>
      </ul>
    </aside>
  );
}
