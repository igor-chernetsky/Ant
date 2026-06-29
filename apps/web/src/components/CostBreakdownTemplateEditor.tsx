'use client';

import type { DefaultCostBreakdownItem } from '@/lib/tendering';

interface CostBreakdownTemplateEditorProps {
  items: DefaultCostBreakdownItem[];
  onChange: (items: DefaultCostBreakdownItem[]) => void;
  disabled?: boolean;
}

const emptyRow = (): DefaultCostBreakdownItem => ({
  trade: '',
  description: '',
});

export function CostBreakdownTemplateEditor({
  items,
  onChange,
  disabled = false,
}: CostBreakdownTemplateEditorProps) {
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
      <p className="tag-section-label">Cost breakdown by trade</p>
      <p className="muted cost-breakdown-template-hint">
        Template lines for contractor proposals — amounts are filled by bidders.
      </p>
      <ul className="bid-line-items-list">
        {items.map((item, index) => (
          <li key={index} className="bid-line-item-row bid-line-item-row--template">
            <input
              type="text"
              aria-label="Trade"
              placeholder="Trade (e.g. Plumbing)"
              value={item.trade}
              disabled={disabled}
              onChange={(e) => updateRow(index, { trade: e.target.value })}
            />
            <input
              type="text"
              aria-label="Description"
              placeholder="Description (optional)"
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
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="secondary"
        disabled={disabled || items.length >= 24}
        onClick={() => onChange([...items, emptyRow()])}
      >
        Add line
      </button>
    </div>
  );
}
