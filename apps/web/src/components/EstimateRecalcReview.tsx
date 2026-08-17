'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  formatThb,
  updateProjectEstimateAdjustments,
  type BallparkEstimate,
} from '@/lib/estimate';
import {
  estimateLineKey,
  hasCoreTradeExclusions,
  type EstimateRecalcDiff,
} from '@/lib/estimate-recalc-diff';

interface EstimateRecalcReviewProps {
  projectId: string;
  estimate: BallparkEstimate;
  diff: EstimateRecalcDiff;
  onEstimateUpdated: (estimate: BallparkEstimate) => void;
  onDismiss: () => void;
}

export function EstimateRecalcReview({
  projectId,
  estimate,
  diff,
  onEstimateUpdated,
  onDismiss,
}: EstimateRecalcReviewProps) {
  const { t } = useTranslation();
  const { formatTagLabel } = useAppFormatters();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coreExcludedWarning = useMemo(
    () => hasCoreTradeExclusions(diff.stillExcluded),
    [diff.stillExcluded],
  );

  const midDeltaPercent =
    diff.totalsDelta.previousMid > 0
      ? Math.round(
          ((diff.totalsDelta.nextMid - diff.totalsDelta.previousMid) /
            diff.totalsDelta.previousMid) *
            100,
        )
      : null;

  const excludeSuggestion = async (line: {
    trade: string;
    description: string;
  }) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const excludedLines = [
        ...(estimate.adjustments?.excludedLines ?? []),
        { trade: line.trade, description: line.description },
      ];
      const addedLines = (estimate.adjustments?.addedLines ?? []).map(
        (item) => {
          const priced = estimate.lines.find(
            (row) =>
              estimateLineKey(row) ===
              estimateLineKey({
                trade: item.trade,
                description: item.description || item.trade,
              }),
          );
          return {
            trade: item.trade,
            description: item.description,
            lineMin: priced?.lineMin ?? 0,
            lineMax: priced?.lineMax ?? 0,
          };
        },
      );
      const updated = await updateProjectEstimateAdjustments(projectId, {
        excludedLines,
        addedLines,
      });
      onEstimateUpdated(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('estimateSection.adjustFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="estimate-recalc-review"
      aria-labelledby="estimate-recalc-review-title"
    >
      <div className="estimate-recalc-review-header">
        <h4 id="estimate-recalc-review-title">
          {t('estimateSection.recalcReviewTitle')}
        </h4>
        <button
          type="button"
          className="secondary estimate-recalc-review-dismiss"
          disabled={busy}
          onClick={onDismiss}
        >
          {t('common.close')}
        </button>
      </div>

      <p className="muted estimate-recalc-review-lead">
        {t('estimateSection.recalcReviewLead')}
      </p>

      {coreExcludedWarning && (
        <p className="estimate-recalc-review-warning" role="status">
          {t('estimateSection.recalcCoreExcludedWarning')}
        </p>
      )}

      {diff.totalsDelta.previousMid !== diff.totalsDelta.nextMid && (
        <p className="estimate-recalc-review-totals">
          {t('estimateSection.recalcTotalsChange', {
            previous: formatThb(diff.totalsDelta.previousMid),
            next: formatThb(diff.totalsDelta.nextMid),
            delta:
              midDeltaPercent == null
                ? '—'
                : `${midDeltaPercent > 0 ? '+' : ''}${midDeltaPercent}%`,
          })}
        </p>
      )}

      {diff.stillExcluded.length > 0 && (
        <div className="estimate-recalc-review-group">
          <h5>{t('estimateSection.recalcStillExcluded')}</h5>
          <ul className="estimate-recalc-review-list">
            {diff.stillExcluded.map((line) => (
              <li key={estimateLineKey(line)}>
                <strong>{line.description}</strong>
                <span className="muted">
                  {formatTagLabel(line.trade, line.trade)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.repricedAdditions.length > 0 && (
        <div className="estimate-recalc-review-group">
          <h5>{t('estimateSection.recalcRepricedAdditions')}</h5>
          <ul className="estimate-recalc-review-list">
            {diff.repricedAdditions.map((line) => (
              <li key={`${line.trade}-${line.description}`}>
                <strong>{line.description}</strong>
                <span className="muted estimate-recalc-review-price-change">
                  {formatThb(line.previousMin)} – {formatThb(line.previousMax)}{' '}
                  → {formatThb(line.nextMin)} – {formatThb(line.nextMax)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.newSuggestions.length > 0 && (
        <div className="estimate-recalc-review-group">
          <h5>{t('estimateSection.recalcNewSuggestions')}</h5>
          <p className="muted estimate-recalc-review-hint">
            {t('estimateSection.recalcNewSuggestionsHint')}
          </p>
          <ul className="estimate-recalc-review-list estimate-recalc-review-list--actions">
            {diff.newSuggestions.map((line) => (
              <li key={estimateLineKey(line)}>
                <div>
                  <strong>{line.description}</strong>
                  <span className="muted">
                    {formatTagLabel(line.trade, line.trade)} ·{' '}
                    {formatThb(line.lineMin)} – {formatThb(line.lineMax)}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary estimate-recalc-review-exclude"
                  disabled={busy}
                  onClick={() => void excludeSuggestion(line)}
                >
                  {t('estimateSection.recalcExcludeSuggestion')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.removedFromEstimate.length > 0 && (
        <div className="estimate-recalc-review-group">
          <h5>{t('estimateSection.recalcRemovedBySystem')}</h5>
          <ul className="estimate-recalc-review-list">
            {diff.removedFromEstimate.map((line) => (
              <li key={estimateLineKey(line)}>
                <strong>{line.description}</strong>
                <span className="muted">
                  {formatTagLabel(line.trade, line.trade)} ·{' '}
                  {formatThb(line.previousMin)} – {formatThb(line.previousMax)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
