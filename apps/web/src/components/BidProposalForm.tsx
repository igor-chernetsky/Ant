'use client';

import { useState } from 'react';
import { formatThb } from '@/lib/estimate';
import type { Bid, BidContractTerms, BidLineItem, BidTerms } from '@/lib/tendering';
import {
  BidContractTermsFields,
  contractTermsFromBid,
} from '@/components/BidContractTermsFields';
import { CommercialProposalDownload } from '@/components/CommercialProposalDownload';

export interface BidProposalInput {
  amount: number;
  durationDays?: number;
  notes?: string;
  approach?: string;
  scopeSummary?: string;
  lineItems?: BidLineItem[];
  contractTerms?: BidContractTerms;
}

interface BidProposalFormProps {
  existingBid?: Bid | null;
  busy?: boolean;
  projectTitle?: string;
  projectDistrict?: string | null;
  downloadBidId?: string;
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
  projectTitle,
  projectDistrict,
  downloadBidId,
  onSubmit,
  onWithdraw,
}: BidProposalFormProps) {
  const terms = existingBid?.terms;
  const [amount, setAmount] = useState(
    existingBid?.amount != null ? String(existingBid.amount) : '',
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
  const [showContractTerms, setShowContractTerms] = useState(true);
  const [contractTerms, setContractTerms] = useState<BidContractTerms>(() =>
    contractTermsFromBid(terms, {
      title: projectTitle,
      district: projectDistrict,
    }),
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
            (item.description?.trim() ?? '') ||
            item.amount > 0,
        )
      : [];

    for (const item of activeLineItems) {
      if (!item.trade.trim()) {
        setError('Each cost line needs a trade');
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
        lineItems: activeLineItems.length
          ? activeLineItems.map((item) => ({
              trade: item.trade.trim(),
              ...(item.description?.trim()
                ? { description: item.description.trim() }
                : {}),
              amount: item.amount,
            }))
          : undefined,
        contractTerms: showContractTerms ? contractTerms : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save bid');
    }
  };

  const lineItemsTotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );

  const proposalDownloadable =
    existingBid?.status === 'submitted' ||
    existingBid?.status === 'selected';

  return (
    <div className="bid-proposal-form bid-proposal-form--compact">
      <div className="modal-form bid-proposal-form-fields">
        <div className="bid-proposal-form-row bid-proposal-form-row--amount-duration">
          <label className="bid-proposal-field bid-proposal-field--amount">
            <span className="field-label">
              Total (THB)
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="850 000"
            />
          </label>
          <label className="bid-proposal-field bid-proposal-field--duration">
            <span className="field-label">Duration (days)</span>
            <input
              type="number"
              min="1"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              placeholder="45"
            />
          </label>
        </div>
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
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Price assumes client-supplied fixtures. 30% deposit, balance on completion."
          />
        </label>
        <label>
          Implementation approach
          <span className="field-hint muted">
            Phases, materials, timeline — how you will deliver
          </span>
          <textarea
            rows={4}
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
                  aria-label="Description (optional)"
                  placeholder="Description (optional)"
                  value={item.description ?? ''}
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

      <div className="bid-contract-terms-section">
        <div className="bid-breakdown-toggle">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showContractTerms}
              onChange={(e) => setShowContractTerms(e.target.checked)}
            />
            Include commercial proposal document fields
          </label>
        </div>

        {showContractTerms && (
          <BidContractTermsFields
            value={contractTerms}
            onChange={setContractTerms}
            projectTitle={projectTitle}
            projectDistrict={projectDistrict}
            disabled={busy}
          />
        )}

        {proposalDownloadable && downloadBidId && (
          <div className="bid-contract-terms-actions">
            <CommercialProposalDownload bidId={downloadBidId} />
            <p className="muted bid-contract-terms-download-hint">
              Document reflects the last saved proposal. Submit updates to refresh
              the download.
            </p>
          </div>
        )}
      </div>

      {error && <p className="form-error bid-proposal-form-error">{error}</p>}

      <div className="bid-proposal-form-footer participation-toolbar">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => void handleSubmit()}
        >
          {busy
            ? 'Saving…'
            : existingBid?.status === 'submitted'
              ? 'Update proposal'
              : 'Submit proposal'}
        </button>
        {existingBid?.status === 'submitted' && onWithdraw && (
          <button
            type="button"
            className="secondary participation-toolbar-withdraw"
            disabled={busy}
            onClick={() => void onWithdraw()}
          >
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}
