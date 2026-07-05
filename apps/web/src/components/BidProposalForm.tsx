'use client';

import { useState } from 'react';
import type { ProjectBriefV1 } from '@/lib/projects';
import { formatThb } from '@/lib/estimate';
import type { Bid, BidContractTerms, BidLineItem, BidOffer, BidTerms, DefaultCostBreakdownItem } from '@/lib/tendering';
import {
  BidContractTermsFields,
  contractTermsFromBid,
  defaultScopeSummary,
  pickContractorContractTerms,
  type ContractTermsAudience,
} from '@/components/BidContractTermsFields';
import { inferContractPeriodMonths } from '@/lib/contract-terms-inference';
import {
  activeBreakdownLineItems,
  BREAKDOWN_TOTAL_MISMATCH_MESSAGE,
  breakdownLineItemsSubtotal,
  breakdownTotalsMismatch,
} from '@/lib/bid-breakdown-validation';

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
  /** Seed form fields from another bid (e.g. client counter-offer from contractor proposal). */
  prefillBid?: Bid | null;
  /** Prefill editable fields from a client counter-offer (keeps contract terms from existing bid). */
  prefillOffer?: BidOffer | null;
  busy?: boolean;
  projectTitle?: string;
  projectDistrict?: string | null;
  projectDescription?: string | null;
  projectBrief?: ProjectBriefV1 | null;
  defaultCostBreakdown?: DefaultCostBreakdownItem[];
  projectScopeSummary?: string | null;
  projectContractTerms?: BidContractTerms;
  /** Who fills commercial proposal fields — `none` hides contract terms. */
  contractTermsAudience?: ContractTermsAudience | 'none';
  /** Label for the notes / comment field. */
  notesLabel?: string;
  /** `adjust` — edit a breakdown copied from the contractor proposal. */
  breakdownMode?: 'create' | 'adjust';
  submitLabel?: string;
  onSubmit: (input: BidProposalInput) => Promise<void>;
  onWithdraw?: () => Promise<void>;
}

const emptyLineItem = (): BidLineItem => ({
  trade: '',
  description: '',
  amount: 0,
});

function activeLineItemsFrom(
  showBreakdown: boolean,
  lineItems: BidLineItem[],
): BidLineItem[] {
  if (!showBreakdown) {
    return [];
  }
  return activeBreakdownLineItems(lineItems);
}

function lineItemsFromTerms(
  terms: BidTerms | null | undefined,
  defaults?: DefaultCostBreakdownItem[],
): BidLineItem[] {
  if (terms?.lineItems?.length) {
    return terms.lineItems.map((item) => ({ ...item }));
  }
  const template = (defaults ?? []).filter((item) => item.trade.trim());
  if (template.length > 0) {
    return template.map((item) => ({
      trade: item.trade.trim(),
      description: item.description?.trim() ?? '',
      amount: 0,
    }));
  }
  return [];
}

function hasProjectBreakdownTemplate(
  defaults?: DefaultCostBreakdownItem[],
): boolean {
  return (defaults ?? []).some((item) => item.trade.trim());
}

function buildContractTermsProjectContext(
  projectTitle?: string,
  projectDistrict?: string | null,
  projectDescription?: string | null,
  projectBrief?: ProjectBriefV1 | null,
) {
  return {
    title: projectTitle,
    district: projectDistrict,
    description: projectDescription,
    brief: projectBrief,
  };
}

function proposalSeedFromInputs(
  existingBid: Bid | null | undefined,
  prefillBid: Bid | null | undefined,
  prefillOffer: BidOffer | null | undefined,
): {
  amount: string | number | null | undefined;
  durationDays: number | null | undefined;
  terms: BidTerms | null | undefined;
} {
  if (prefillOffer) {
    const offerTerms = prefillOffer.terms;
    return {
      amount: prefillOffer.amount,
      durationDays: prefillOffer.durationDays,
      terms: {
        ...existingBid?.terms,
        notes: prefillOffer.note ?? offerTerms?.notes ?? existingBid?.terms?.notes,
        approach: offerTerms?.approach ?? existingBid?.terms?.approach,
        scopeSummary:
          offerTerms?.scopeSummary ?? existingBid?.terms?.scopeSummary,
        lineItems: offerTerms?.lineItems ?? existingBid?.terms?.lineItems,
        contractTerms: existingBid?.terms?.contractTerms,
      },
    };
  }

  const seedBid = existingBid ?? prefillBid;
  return {
    amount: seedBid?.amount,
    durationDays: seedBid?.durationDays ?? null,
    terms: seedBid?.terms,
  };
}

export function BidProposalForm({
  existingBid,
  prefillBid = null,
  prefillOffer = null,
  busy = false,
  projectTitle,
  projectDistrict,
  projectDescription,
  projectBrief = null,
  defaultCostBreakdown = [],
  projectScopeSummary = null,
  projectContractTerms,
  contractTermsAudience = 'contractor',
  notesLabel = 'Comment for the client',
  breakdownMode = 'create',
  submitLabel,
  onSubmit,
  onWithdraw,
}: BidProposalFormProps) {
  const seed = proposalSeedFromInputs(existingBid, prefillBid, prefillOffer);
  const terms = seed.terms;
  const projectTermsSeed = {
    scopeSummary: terms?.scopeSummary ?? projectScopeSummary ?? undefined,
    contractTerms: {
      ...projectContractTerms,
      ...terms?.contractTerms,
    },
  };
  const projectContext = buildContractTermsProjectContext(
    projectTitle,
    projectDistrict,
    projectDescription,
    projectBrief,
  );
  const [amount, setAmount] = useState(
    seed.amount != null ? String(seed.amount) : '',
  );
  const [durationDays, setDurationDays] = useState(
    seed.durationDays?.toString() ?? '',
  );
  const [notes, setNotes] = useState(terms?.notes ?? '');
  const [approach, setApproach] = useState(terms?.approach ?? '');
  const [scopeSummary, setScopeSummary] = useState(() =>
    defaultScopeSummary(projectTermsSeed, projectContext),
  );
  const [lineItems, setLineItems] = useState<BidLineItem[]>(() =>
    lineItemsFromTerms(terms, defaultCostBreakdown),
  );
  const [showBreakdown, setShowBreakdown] = useState(() => {
    const hasSavedBreakdown = (terms?.lineItems?.length ?? 0) > 0;
    if (breakdownMode === 'adjust' || prefillOffer) {
      return hasSavedBreakdown;
    }
    return hasSavedBreakdown || hasProjectBreakdownTemplate(defaultCostBreakdown);
  });
  const projectTemplateBreakdown = hasProjectBreakdownTemplate(defaultCostBreakdown);
  const [contractTerms, setContractTerms] = useState<BidContractTerms>(() =>
    contractTermsFromBid(
      projectTermsSeed,
      projectContext,
      seed.durationDays ?? existingBid?.durationDays,
    ),
  );
  const [error, setError] = useState<string | null>(null);

  const handleDurationChange = (value: string) => {
    setDurationDays(value);
    const parsed = value.trim() ? Number(value) : undefined;
    if (
      parsed !== undefined &&
      Number.isFinite(parsed) &&
      parsed >= 1 &&
      contractTerms.contractPeriodMonths == null
    ) {
      setContractTerms((current) => ({
        ...current,
        contractPeriodMonths:
          inferContractPeriodMonths({ durationDays: parsed, brief: projectBrief }) ??
          Math.max(1, Math.round(parsed / 30)),
      }));
    }
  };

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

    const activeLineItems = activeLineItemsFrom(showBreakdown, lineItems);

    for (const item of activeLineItems) {
      if (!item.trade.trim()) {
        setError('Each cost line needs a trade');
        return;
      }
    }

    const breakdownSubtotal = breakdownLineItemsSubtotal(activeLineItems);
    if (
      showBreakdown &&
      activeLineItems.length > 0 &&
      breakdownTotalsMismatch(parsedAmount, activeLineItems)
    ) {
      setError(BREAKDOWN_TOTAL_MISMATCH_MESSAGE);
      return;
    }

    const scopeText = scopeSummary.trim();

    try {
      await onSubmit({
        amount: parsedAmount,
        durationDays: parsedDuration,
        notes: notes.trim() || undefined,
        approach: approach.trim() || undefined,
        scopeSummary: scopeText || undefined,
        lineItems: activeLineItems.length
          ? activeLineItems.map((item) => ({
              trade: item.trade.trim(),
              ...(item.description?.trim()
                ? { description: item.description.trim() }
                : {}),
              amount: item.amount,
            }))
          : undefined,
        contractTerms:
          contractTermsAudience !== 'none'
            ? contractTermsAudience === 'contractor'
              ? {
                  ...pickContractorContractTerms(contractTerms),
                  ...(scopeText ? { subjectOfContract: scopeText } : {}),
                }
              : contractTerms
            : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save bid');
    }
  };

  const activeLineItems = activeLineItemsFrom(showBreakdown, lineItems);
  const breakdownSubtotal = breakdownLineItemsSubtotal(activeLineItems);
  const parsedAmount = Number(amount);
  const amountIsValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const breakdownMismatch =
    showBreakdown &&
    activeLineItems.length > 0 &&
    amountIsValid &&
    breakdownTotalsMismatch(parsedAmount, activeLineItems);

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
              placeholder="e.g. 850000"
              inputMode="numeric"
            />
          </label>
          <label className="bid-proposal-field bid-proposal-field--duration">
            <span className="field-label">Duration (days)</span>
            <input
              type="number"
              min="1"
              value={durationDays}
              onChange={(e) => handleDurationChange(e.target.value)}
              placeholder="e.g. 45"
              inputMode="numeric"
            />
          </label>
        </div>

        {breakdownMismatch && (
          <p className="form-error bid-proposal-total-error" role="alert">
            {BREAKDOWN_TOTAL_MISMATCH_MESSAGE}
          </p>
        )}

        <label>
          Subject / scope of works
          <span className="field-hint muted">
            Used in the commercial proposal document and shared with the client
          </span>
          <textarea
            rows={3}
            value={scopeSummary}
            onChange={(e) => setScopeSummary(e.target.value)}
            placeholder={
              projectDescription?.trim() ||
              'Full kitchen renovation including cabinets, countertops, plumbing…'
            }
          />
        </label>

        <label>
          {notesLabel}
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

        {contractTermsAudience !== 'none' && (
          <BidContractTermsFields
            value={contractTerms}
            onChange={setContractTerms}
            audience={contractTermsAudience}
            projectTitle={projectTitle}
            projectDistrict={projectDistrict}
            disabled={busy}
            hideSubjectOfContract
            showSectionHeader={false}
          />
        )}
      </div>

      <div className="bid-breakdown-toggle">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showBreakdown}
            onChange={(e) => {
              setShowBreakdown(e.target.checked);
              if (e.target.checked && lineItems.length === 0) {
                const seeded = lineItemsFromTerms(terms, defaultCostBreakdown);
                setLineItems(seeded.length > 0 ? seeded : [emptyLineItem()]);
              }
            }}
          />
          {breakdownMode === 'adjust'
            ? 'Adjust cost breakdown by trade'
            : projectTemplateBreakdown
              ? 'Fill in cost breakdown by trade'
              : 'Add cost breakdown by trade'}
        </label>
      </div>

      {showBreakdown && (
        <div className="bid-line-items">
          <p className="tag-section-label">
            {breakdownMode === 'adjust'
              ? 'Contractor cost breakdown'
              : projectTemplateBreakdown
                ? 'Project cost breakdown'
                : 'Cost breakdown (optional)'}
          </p>
          {breakdownMode === 'adjust' && (
            <p className="muted bid-line-items-hint">
              Based on the contractor&apos;s proposal. Adjust amounts or add and
              remove rows as needed.
            </p>
          )}
          {breakdownMode === 'create' && projectTemplateBreakdown && (
            <p className="muted bid-line-items-hint">
              From the project template. Enter amounts for each trade and adjust
              rows as needed.
            </p>
          )}
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
          {showBreakdown && activeLineItems.length > 0 && (
            <p className="muted bid-line-items-total">
              Breakdown subtotal: {formatThb(breakdownSubtotal)}
            </p>
          )}
          {breakdownMismatch && showBreakdown && (
            <p className="form-error bid-line-items-total-error" role="alert">
              {BREAKDOWN_TOTAL_MISMATCH_MESSAGE}
            </p>
          )}
        </div>
      )}

      {error && !breakdownMismatch && (
        <p className="form-error bid-proposal-form-error">{error}</p>
      )}

      <div className="bid-proposal-form-footer participation-toolbar">
        <button
          type="button"
          className="primary"
          disabled={busy || breakdownMismatch}
          onClick={() => void handleSubmit()}
        >
          {busy
            ? 'Saving…'
            : submitLabel ??
              (existingBid?.status === 'submitted'
                ? 'Update proposal'
                : 'Submit proposal')}
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
