'use client';

import { useTranslation } from '@/components/LocaleProvider';
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

export function CostBreakdownTemplateEditor({
  items,
  onChange,
  disabled = false,
  isDesign = false,
}: CostBreakdownTemplateEditorProps) {
  const { t } = useTranslation();

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
            <input
              type="text"
              aria-label={t('common.trade')}
              placeholder={t('bid.tradePlaceholder')}
              value={item.trade}
              disabled={disabled}
              onChange={(e) => updateRow(index, { trade: e.target.value })}
            />
            <input
              type="text"
              aria-label={t('costBreakdown.descriptionAria')}
              placeholder={t('common.descriptionOptional')}
              value={item.description ?? ''}
              disabled={disabled}
              onChange={(e) => updateRow(index, { description: e.target.value })}
            />
            <button
              type="button"
              className="secondary bid-line-item-remove"
              disabled={disabled || items.length <= 1}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              {t('common.remove')}
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
