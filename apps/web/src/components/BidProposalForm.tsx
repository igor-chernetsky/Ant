'use client';

import { useState } from 'react';
import { formatThb } from '@/lib/estimate';
import type { Bid, BidLineItem, BidTerms } from '@/lib/tendering';

export interface BidProposalInput {
  amount: number;
  durationDays?: number;
  notes?: string;
  approach?: string;
  scopeSummary?: string;
  lineItems?: BidLineItem[];
}

interface BidProposalFormProps {
  existingBid?: Bid | null;
  busy?: boolean;
  onSubmit: (input: BidProposalInput) => Promise<void>;
  onWithdraw?: () => Promise<void>;
}

const emptyLineItem = (): BidLineItem => ({
  trade: '',
  description: '',
  amount: 0,
});

function lineItemsFromTerms(terms: BidTerms | null | undefined): BidLineItem[] {
  if (terms?.lineItems?.length) {
    return terms.lineItems.map((item) => ({ ...item }));
  }
  return [];
}

export function BidProposalForm({
  existingBid,
  busy = false,
  onSubmit,
  onWithdraw,
}: BidProposalFormProps) {
  const terms = existingBid?.terms;
  const [amount, setAmount] = useState(
    existingBid ? String(existingBid.amount) : '',
  );
  const [durationDays, setDurationDays] = useState(
    existingBid?.durationDays?.toString() ?? '',
  );
  const [notes, setNotes] = useState(terms?.notes ?? '');
  const [approach, setApproach] = useState(terms?.approach ?? '');
  const [scopeSummary, setScopeSummary] = useState(terms?.scopeSummary ?? '');
  const [lineItems, setLineItems] = useState<BidLineItem[]>(() =>
    lineItemsFromTerms(terms),
  );
  const [showBreakdown, setShowBreakdown] = useState(
    (terms?.lineItems?.length ?? 0) > 0,
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid total amount');
      return;
    }

    const parsedDuration = durationDays.trim()
      ? Number(durationDays)
      : undefined;
    if (
      parsedDuration !== undefined &&
      (!Number.isFinite(parsedDuration) || parsedDuration < 1)
    ) {
      setError('Duration must be at least 1 day');
      return;
    }

    const activeLineItems = showBreakdown
      ? lineItems.filter(
          (item) =>
            item.trade.trim() ||
            item.description.trim() ||
            item.amount > 0,
        )
      : [];

    for (const item of activeLineItems) {
      if (!item.trade.trim() || !item.description.trim()) {
        setError('Each cost line needs a trade and description');
        return;
      }
    }

    try {
      await onSubmit({
        amount: parsedAmount,
        durationDays: parsedDuration,
        notes: notes.trim() || undefined,
        approach: approach.trim() || undefined,
        scopeSummary: scopeSummary.trim() || undefined,
        lineItems: activeLineItems.length ? activeLineItems : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save bid');
    }
  };

  const lineItemsTotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );

  return (
    <div className="bid-proposal-form">
      <div className="modal-form">
        <label>
          Total bid amount (THB) <span className="required-mark">*</span>
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 850000"
          />
        </label>
        <label>
          Estimated duration (days)
          <input
            type="number"
            min="1"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            placeholder="e.g. 45"
          />
        </label>
        <label>
          Scope summary
          <span className="field-hint muted">
            One or two sentences on what is included in your price
          </span>
          <textarea
            rows={2}
            value={scopeSummary}
            onChange={(e) => setScopeSummary(e.target.value)}
            placeholder="Full kitchen renovation including cabinets, countertops, plumbing…"
          />
        </label>
        <label>
          Comment for the client
          <span className="field-hint muted">
            Assumptions, payment terms, exclusions
          </span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Price assumes client-supplied fixtures. 30% deposit, balance on completion."
          />
        </label>
        <label>
          Implementation approach
          <span className="field-hint muted">
            Phases, materials, timeline — your proposal for how you will deliver
          </span>
          <textarea
            rows={6}
            value={approach}
            onChange={(e) => setApproach(e.target.value)}
            placeholder="Week 1–2: demolition and rough-in. Week 3–4: tiling and cabinetry install…"
          />
        </label>
      </div>

      <div className="bid-breakdown-toggle">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showBreakdown}
            onChange={(e) => {
              setShowBreakdown(e.target.checked);
              if (e.target.checked && lineItems.length === 0) {
                setLineItems([emptyLineItem()]);
              }
            }}
          />
          Add cost breakdown by trade
        </label>
      </div>

      {showBreakdown && (
        <div className="bid-line-items">
          <p className="tag-section-label">Cost breakdown (optional)</p>
          <ul className="bid-line-items-list">
            {lineItems.map((item, index) => (
              <li key={index} className="bid-line-item-row">
                <input
                  type="text"
                  aria-label="Trade"
                  placeholder="Trade (e.g. Plumbing)"
                  value={item.trade}
                  onChange={(e) => {
                    const next = [...lineItems];
                    next[index] = { ...item, trade: e.target.value };
                    setLineItems(next);
                  }}
                />
                <input
                  type="text"
                  aria-label="Description"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => {
                    const next = [...lineItems];
                    next[index] = { ...item, description: e.target.value };
                    setLineItems(next);
                  }}
                />
                <input
                  type="number"
                  min="0"
                  aria-label="Amount"
                  placeholder="THB"
                  value={item.amount || ''}
                  onChange={(e) => {
                    const next = [...lineItems];
                    next[index] = {
                      ...item,
                      amount: Number(e.target.value) || 0,
                    };
                    setLineItems(next);
                  }}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove line"
                  disabled={lineItems.length <= 1}
                  onClick={() =>
                    setLineItems(lineItems.filter((_, i) => i !== index))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="secondary"
            onClick={() => setLineItems([...lineItems, emptyLineItem()])}
          >
            Add line
          </button>
          {lineItemsTotal > 0 && (
            <p className="muted bid-line-items-total">
              Breakdown subtotal: {formatThb(lineItemsTotal)}
              {amount &&
                Math.abs(lineItemsTotal - Number(amount)) > 1 && (
                  <span className="bid-line-items-warn">
                    {' '}
                    (differs from total bid)
                  </span>
                )}
            </p>
          )}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="tender-actions-block bid-proposal-submit">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => void handleSubmit()}
        >
          {busy
            ? 'Saving…'
            : existingBid?.status === 'submitted'
              ? 'Update bid'
              : 'Submit bid'}
        </button>
        {existingBid?.status === 'submitted' && onWithdraw && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void onWithdraw()}
          >
            Withdraw bid
          </button>
        )}
      </div>
    </div>
  );
}
