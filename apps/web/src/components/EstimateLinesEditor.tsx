'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  formatThb,
  updateProjectEstimateAdjustments,
  type BallparkEstimate,
  type EstimateLine,
} from '@/lib/estimate';

interface EstimateLinesEditorProps {
  projectId: string;
  estimate: BallparkEstimate;
  onEstimateUpdated: (estimate: BallparkEstimate) => void;
}

function lineKey(line: Pick<EstimateLine, 'trade' | 'description'>): string {
  return `${line.trade}::${line.description}`;
}

export function EstimateLinesEditor({
  projectId,
  estimate,
  onEstimateUpdated,
}: EstimateLinesEditorProps) {
  const { t } = useTranslation();
  const { formatTagLabel } = useAppFormatters();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState('');
  const [addedDescription, setAddedDescription] = useState('');

  const editable = estimate.editable ?? false;
  const excluded = estimate.adjustments?.excludedLines ?? [];
  const added = estimate.adjustments?.addedLines ?? [];

  const availableTrades = useMemo(() => {
    const existing = new Set(
      estimate.lines.map((line) => line.trade.trim().toLowerCase()),
    );
    return (estimate.availableTrades ?? []).filter(
      (item) => !existing.has(item.trade.trim().toLowerCase()),
    );
  }, [estimate.availableTrades, estimate.lines]);

  const persist = async (nextExcluded: typeof excluded, nextAdded: typeof added) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateProjectEstimateAdjustments(projectId, {
        excludedLines: nextExcluded,
        addedLines: nextAdded,
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

  const handleRemoveLine = (line: EstimateLine) => {
    if (!editable || busy) return;
    const key = lineKey(line);
    if (added.some((item) => lineKey(item) === key)) {
      void persist(
        excluded,
        added.filter((item) => lineKey(item) !== key),
      );
      return;
    }
    void persist(
      [...excluded, { trade: line.trade, description: line.description }],
      added,
    );
  };

  const handleAddLine = () => {
    if (!editable || busy || !selectedTrade) return;
    const tradeItem = availableTrades.find((item) => item.trade === selectedTrade);
    if (!tradeItem) return;
    const description = addedDescription.trim() || tradeItem.label;
    const key = lineKey({ trade: selectedTrade, description });
    if (added.some((item) => lineKey(item) === key)) {
      setError(t('estimateSection.tradeAlreadyAdded'));
      return;
    }
    void persist(excluded, [
      ...added,
      { trade: selectedTrade, description },
    ]);
    setSelectedTrade('');
    setAddedDescription('');
  };

  if (estimate.lines.length === 0) {
    return null;
  }

  return (
    <div className="estimate-lines-editor">
      <ul className="estimate-lines">
        {estimate.lines.map((line, index) => (
          <li key={`${line.trade}-${index}`} className="estimate-line">
            <div>
              <strong>{line.description}</strong>
              <span className="muted estimate-line-trade">
                {formatTagLabel(line.trade, line.trade)}
              </span>
            </div>
            <div className="estimate-line-actions">
              <span className="estimate-line-amount">
                {formatThb(line.lineMin)} – {formatThb(line.lineMax)}
              </span>
              {editable && (
                <button
                  type="button"
                  className="icon-button estimate-line-remove"
                  aria-label={t('estimateSection.removeLineAria')}
                  disabled={busy}
                  onClick={() => handleRemoveLine(line)}
                >
                  ×
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editable && (
        <div className="estimate-lines-add">
          <p className="tag-section-label">{t('estimateSection.addLineTitle')}</p>
          <p className="muted estimate-lines-add-hint">
            {t('estimateSection.addLineHint')}
          </p>
          <div className="estimate-lines-add-row">
            <label>
              {t('estimateSection.addLineTrade')}
              <select
                value={selectedTrade}
                onChange={(e) => setSelectedTrade(e.target.value)}
                disabled={busy || availableTrades.length === 0}
              >
                <option value="">{t('estimateSection.addLineTradePlaceholder')}</option>
                {availableTrades.map((item) => (
                  <option key={item.trade} value={item.trade}>
                    {formatTagLabel(item.trade, item.label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('estimateSection.addLineDescription')}
              <input
                type="text"
                value={addedDescription}
                onChange={(e) => setAddedDescription(e.target.value)}
                placeholder={t('estimateSection.addLineDescriptionPlaceholder')}
                disabled={busy}
              />
            </label>
            <button
              type="button"
              className="secondary"
              disabled={busy || !selectedTrade}
              onClick={() => handleAddLine()}
            >
              {t('estimateSection.addLineButton')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="form-error estimate-lines-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
