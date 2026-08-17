'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
  formatThb,
  updateProjectEstimateAdjustments,
  type BallparkEstimate,
  type EstimateLine,
} from '@/lib/estimate';
import { isCoreEstimateTrade } from '@/lib/estimate-recalc-diff';

interface EstimateLinesEditorProps {
  projectId: string;
  estimate: BallparkEstimate;
  onEstimateUpdated: (estimate: BallparkEstimate) => void;
}

type AddedLineRef = { trade: string; description: string };

type AddedLinePayload = AddedLineRef & {
  lineMin: number;
  lineMax: number;
};

const MAX_LINE_AMOUNT_THB = 500_000_000;

function lineKey(line: Pick<EstimateLine, 'trade' | 'description'>): string {
  return `${line.trade}::${line.description}`;
}

function parseThbInput(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

function validateLineAmounts(
  lineMin: number,
  lineMax: number,
): 'invalid' | 'negative' | 'max_lt_min' | 'too_large' | null {
  if (!Number.isFinite(lineMin) || !Number.isFinite(lineMax)) {
    return 'invalid';
  }
  if (!Number.isInteger(lineMin) || !Number.isInteger(lineMax)) {
    return 'invalid';
  }
  if (lineMin < 0 || lineMax < 0) {
    return 'negative';
  }
  if (lineMax < lineMin) {
    return 'max_lt_min';
  }
  if (lineMin > MAX_LINE_AMOUNT_THB || lineMax > MAX_LINE_AMOUNT_THB) {
    return 'too_large';
  }
  return null;
}

export function EstimateLinesEditor({
  projectId,
  estimate,
  onEstimateUpdated,
}: EstimateLinesEditorProps) {
  const { t } = useTranslation();
  const { formatTagLabel } = useAppFormatters();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState('');
  const [addedDescription, setAddedDescription] = useState('');
  const [lineMinInput, setLineMinInput] = useState('');
  const [lineMaxInput, setLineMaxInput] = useState('');

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

  const selectedTradeItem = useMemo(
    () => availableTrades.find((item) => item.trade === selectedTrade) ?? null,
    [availableTrades, selectedTrade],
  );

  const mapAddedForSave = (items: AddedLineRef[]): AddedLinePayload[] =>
    items.map((item) => {
      const priced = estimate.lines.find((line) => lineKey(line) === lineKey(item));
      return {
        trade: item.trade,
        description: item.description,
        lineMin: priced?.lineMin ?? 0,
        lineMax: priced?.lineMax ?? 0,
      };
    });

  const persist = async (
    nextExcluded: typeof excluded,
    nextAdded: AddedLinePayload[],
  ): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateProjectEstimateAdjustments(projectId, {
        excludedLines: nextExcluded,
        addedLines: nextAdded,
      });
      onEstimateUpdated(updated);
      return true;
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('estimateSection.adjustFailed'),
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const validationMessage = (code: ReturnType<typeof validateLineAmounts>) => {
    switch (code) {
      case 'negative':
        return t('estimateSection.addLineNegative');
      case 'max_lt_min':
        return t('estimateSection.addLineMaxLtMin');
      case 'too_large':
        return t('estimateSection.addLineTooLarge');
      case 'invalid':
      default:
        return t('estimateSection.addLineInvalidAmount');
    }
  };

  const handleRemoveLine = async (line: EstimateLine) => {
    if (!editable || busy) return;
    const key = lineKey(line);
    if (added.some((item) => lineKey(item) === key)) {
      void persist(
        excluded,
        mapAddedForSave(added.filter((item) => lineKey(item) !== key)),
      );
      return;
    }

    if (isCoreEstimateTrade(line.trade)) {
      const tradeLabel = formatTagLabel(line.trade, line.trade);
      const confirmed = await confirm({
        title: t('estimateSection.excludeCoreTitle'),
        message: t('estimateSection.excludeCoreMessage', {
          trade: tradeLabel,
          description: line.description,
        }),
        confirmLabel: t('estimateSection.excludeCoreConfirm'),
        cancelLabel: t('common.cancel'),
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    void persist(
      [...excluded, { trade: line.trade, description: line.description }],
      mapAddedForSave(added),
    );
  };

  const handleTradeChange = (trade: string) => {
    setSelectedTrade(trade);
    setError(null);
    const tradeItem = availableTrades.find((item) => item.trade === trade);
    if (tradeItem) {
      setLineMinInput(String(tradeItem.lineMin));
      setLineMaxInput(String(tradeItem.lineMax));
      return;
    }
    setLineMinInput('');
    setLineMaxInput('');
  };

  const resetAddForm = () => {
    setSelectedTrade('');
    setAddedDescription('');
    setLineMinInput('');
    setLineMaxInput('');
  };

  const handleAddLine = () => {
    if (!editable || busy || !selectedTrade || !selectedTradeItem) return;

    const lineMin = parseThbInput(lineMinInput);
    const lineMax = parseThbInput(lineMaxInput);
    if (lineMin == null || lineMax == null) {
      setError(t('estimateSection.addLineInvalidAmount'));
      return;
    }

    const rangeError = validateLineAmounts(lineMin, lineMax);
    if (rangeError) {
      setError(validationMessage(rangeError));
      return;
    }

    const description =
      addedDescription.trim() || selectedTradeItem.label;
    const key = lineKey({ trade: selectedTrade, description });
    if (added.some((item) => lineKey(item) === key)) {
      setError(t('estimateSection.tradeAlreadyAdded'));
      return;
    }

    void persist(excluded, [
      ...mapAddedForSave(added),
      {
        trade: selectedTrade,
        description,
        lineMin,
        lineMax,
      },
    ]).then((ok) => {
      if (ok) {
        resetAddForm();
      }
    });
  };

  if (estimate.lines.length === 0) {
    return null;
  }

  const parsedMin = parseThbInput(lineMinInput);
  const parsedMax = parseThbInput(lineMaxInput);
  const showPreview =
    selectedTrade &&
    parsedMin != null &&
    parsedMax != null &&
    validateLineAmounts(parsedMin, parsedMax) == null;

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
        <section className="estimate-lines-add-panel" aria-labelledby="estimate-add-line-title">
          <div className="estimate-lines-add-header">
            <h4 id="estimate-add-line-title" className="estimate-lines-add-title">
              {t('estimateSection.addLineTitle')}
            </h4>
            <p className="muted estimate-lines-add-hint">
              {t('estimateSection.addLineHint')}
            </p>
          </div>

          <div className="estimate-lines-add-form">
            <label className="estimate-lines-add-field estimate-lines-add-field--trade">
              <span className="field-label">{t('estimateSection.addLineTrade')}</span>
              <select
                className="estimate-lines-add-control"
                value={selectedTrade}
                onChange={(e) => handleTradeChange(e.target.value)}
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

            <label className="estimate-lines-add-field estimate-lines-add-field--description">
              <span className="field-label">
                {t('estimateSection.addLineDescription')}
              </span>
              <input
                type="text"
                className="estimate-lines-add-control"
                value={addedDescription}
                onChange={(e) => setAddedDescription(e.target.value)}
                placeholder={t('estimateSection.addLineDescriptionPlaceholder')}
                disabled={busy}
              />
            </label>

            <label className="estimate-lines-add-field estimate-lines-add-field--min">
              <span className="field-label">{t('estimateSection.addLineMin')}</span>
              <input
                type="number"
                className="estimate-lines-add-control estimate-lines-add-amount"
                inputMode="numeric"
                min={0}
                step={1}
                value={lineMinInput}
                onChange={(e) => {
                  setLineMinInput(e.target.value);
                  setError(null);
                }}
                placeholder="0"
                disabled={busy || !selectedTrade}
              />
            </label>

            <label className="estimate-lines-add-field estimate-lines-add-field--max">
              <span className="field-label">{t('estimateSection.addLineMax')}</span>
              <input
                type="number"
                className="estimate-lines-add-control estimate-lines-add-amount"
                inputMode="numeric"
                min={0}
                step={1}
                value={lineMaxInput}
                onChange={(e) => {
                  setLineMaxInput(e.target.value);
                  setError(null);
                }}
                placeholder="0"
                disabled={busy || !selectedTrade}
              />
            </label>

            <div className="estimate-lines-add-field estimate-lines-add-field--submit">
              <span className="field-label estimate-lines-add-submit-label" aria-hidden="true">
                &nbsp;
              </span>
              <button
                type="button"
                className="secondary estimate-lines-add-submit"
                disabled={
                  busy ||
                  !selectedTrade ||
                  lineMinInput.trim() === '' ||
                  lineMaxInput.trim() === ''
                }
                onClick={() => handleAddLine()}
              >
                {t('estimateSection.addLineButton')}
              </button>
            </div>

            {showPreview && (
              <p className="estimate-lines-add-preview muted">
                {t('estimateSection.addLinePreview', {
                  min: formatThb(parsedMin),
                  max: formatThb(parsedMax),
                })}
              </p>
            )}
          </div>
        </section>
      )}

      {error && (
        <p className="form-error estimate-lines-error" role="alert">
          {error}
        </p>
      )}
      {confirmDialog}
    </div>
  );
}
