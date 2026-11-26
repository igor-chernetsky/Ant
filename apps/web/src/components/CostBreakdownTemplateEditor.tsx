'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { CORE_ESTIMATE_TRADES } from '@/lib/estimate-recalc-diff';
import type { DefaultCostBreakdownItem } from '@/lib/tendering';

interface CostBreakdownTemplateEditorProps {
  items: DefaultCostBreakdownItem[];
  onChange: (items: DefaultCostBreakdownItem[]) => void;
  disabled?: boolean;
  isDesign?: boolean;
}

const emptyRow = (): DefaultCostBreakdownItem => ({
  trade: '',
  description: '',
});

/**
 * Mirrors `MAX_DEFAULT_COST_BREAKDOWN_ITEMS` on the API, which trims the stored
 * template to this many rows. A higher cap here would silently drop whatever the
 * client added beyond it, so the contractor would receive a shorter list.
 */
const MAX_COST_BREAKDOWN_ITEMS = 20;

/** Catalogue order, so the dropdown is predictable rather than alphabetical noise. */
const TRADE_KEYS = [...CORE_ESTIMATE_TRADES];
const CUSTOM_TRADE = '__custom__';

export function CostBreakdownTemplateEditor({
  items,
  onChange,
  disabled = false,
  isDesign = false,
}: CostBreakdownTemplateEditorProps) {
  const { t } = useTranslation();
  const { formatTagLabel } = useAppFormatters();
  /** Rows the client explicitly switched to a free-text trade. */
  const [customRows, setCustomRows] = useState<Set<number>>(new Set());

  const isCustomTrade = (index: number, trade: string): boolean =>
    customRows.has(index) ||
    (trade !== '' && !CORE_ESTIMATE_TRADES.has(trade));

  const updateRow = (
    index: number,
    patch: Partial<DefaultCostBreakdownItem>,
  ) => {
    const next = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    onChange(next);
  };

  return (
    <div className="cost-breakdown-template-editor">
      <p className="tag-section-label">{t('costBreakdown.title')}</p>
      <p className="muted cost-breakdown-template-hint">
        {t(isDesign ? 'costBreakdown.hintDesign' : 'costBreakdown.hint')}
      </p>
      <ul className="bid-line-items-list">
        {items.map((item, index) => (
          <li key={index} className="bid-line-item-row bid-line-item-row--template">
            <div className="bid-line-item-trade">
              {/* Trade from the catalogue: consistent slugs and capitalisation, with a
                  free-text escape hatch for work the catalogue does not list. */}
              <select
                aria-label={t('common.trade')}
                value={isCustomTrade(index, item.trade) ? CUSTOM_TRADE : item.trade}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === CUSTOM_TRADE) {
                    setCustomRows((current) => new Set(current).add(index));
                    updateRow(index, { trade: '' });
                    return;
                  }
                  setCustomRows((current) => {
                    const copy = new Set(current);
                    copy.delete(index);
                    return copy;
                  });
                  updateRow(index, { trade: next });
                }}
              >
                <option value="">{t('bid.tradePlaceholder')}</option>
                {TRADE_KEYS.map((trade) => (
                  <option key={trade} value={trade}>
                    {formatTagLabel(trade, trade)}
                  </option>
                ))}
                <option value={CUSTOM_TRADE}>{t('bid.tradeCustom')}</option>
              </select>
              {isCustomTrade(index, item.trade) && (
                <input
                  type="text"
                  aria-label={t('common.trade')}
                  placeholder={t('bid.tradePlaceholder')}
                  value={item.trade}
                  disabled={disabled}
                  onChange={(e) =>
                    updateRow(index, { trade: e.target.value })
                  }
                />
              )}
            </div>
            <textarea
              rows={1}
              className="bid-line-item-description"
              aria-label={t('costBreakdown.descriptionAria')}
              placeholder={t('common.descriptionOptional')}
              value={item.description ?? ''}
              disabled={disabled}
              onChange={(e) => updateRow(index, { description: e.target.value })}
            />
            <button
              type="button"
              className="icon-button bid-line-item-remove"
              aria-label={t('common.remove')}
              title={t('common.remove')}
              disabled={disabled || items.length <= 1}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="secondary"
        disabled={disabled || items.length >= MAX_COST_BREAKDOWN_ITEMS}
        onClick={() => onChange([...items, emptyRow()])}
      >
        {t('common.addLine')}
      </button>
    </div>
  );
}
