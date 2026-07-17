'use client';

import { useState, type ReactNode } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
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
  scopeLabel?: string;
  scopeHint?: string;
  submitLabel?: string;
  /** Rendered next to the submit button (e.g. bulk counter-offer checkbox). */
  footerExtra?: ReactNode;
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
  notesLabel,
  breakdownMode = 'create',
  scopeLabel,
  scopeHint,
  submitLabel,
  footerExtra,
  onSubmit,
  onWithdraw,
}: BidProposalFormProps) {
  const { t } = useTranslation();
  const resolvedNotesLabel = notesLabel ?? t('bid.commentForClient');
  const resolvedScopeLabel = scopeLabel ?? t('bid.scopeOfWorks');
  const resolvedScopeHint = scopeHint ?? t('bid.scopeHint');
  const breakdownMismatchMessage = t('bid.errors.breakdownMismatch');
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
      setError(t('bid.errors.invalidAmount'));
      return;
    }

    const parsedDuration = durationDays.trim()
      ? Number(durationDays)
      : undefined;
    if (
      parsedDuration !== undefined &&
      (!Number.isFinite(parsedDuration) || parsedDuration < 1)
    ) {
      setError(t('bid.errors.durationMin'));
      return;
    }

    const activeLineItems = activeLineItemsFrom(showBreakdown, lineItems);

    for (const item of activeLineItems) {
      if (!item.trade.trim()) {
        setError(t('bid.errors.tradeRequired'));
        return;
      }
    }

    const breakdownSubtotal = breakdownLineItemsSubtotal(activeLineItems);
    if (
      showBreakdown &&
      activeLineItems.length > 0 &&
      breakdownTotalsMismatch(parsedAmount, activeLineItems)
    ) {
      setError(breakdownMismatchMessage);
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
      setError(err instanceof Error ? err.message : t('bid.saveBidFailed'));
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
              {t('bid.totalThb')}
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
              placeholder={t('bid.amountPlaceholder')}
              inputMode="numeric"
            />
          </label>
          <label className="bid-proposal-field bid-proposal-field--duration">
            <span className="field-label">{t('bid.durationDays')}</span>
            <input
              type="number"
              min="1"
              value={durationDays}
              onChange={(e) => handleDurationChange(e.target.value)}
              placeholder={t('bid.durationPlaceholder')}
              inputMode="numeric"
            />
          </label>
        </div>

        {breakdownMismatch && (
          <p className="form-error bid-proposal-total-error" role="alert">
            {breakdownMismatchMessage}
          </p>
        )}

        <label>
          {resolvedScopeLabel}
          <span className="field-hint muted">{resolvedScopeHint}</span>
          <textarea
            rows={3}
            value={scopeSummary}
            onChange={(e) => setScopeSummary(e.target.value)}
            placeholder={
              projectDescription?.trim() ||
              (projectTitle
                ? t('bid.scopePlaceholderProject', { title: projectTitle })
                : t('bid.scopePlaceholder'))
            }
          />
        </label>

        <label>
          {resolvedNotesLabel}
          <span className="field-hint muted">{t('bid.commentHint')}</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('bid.commentPlaceholder')}
          />
        </label>

        <label>
          {t('bid.implementationApproach')}
          <span className="field-hint muted">{t('bid.approachHint')}</span>
          <textarea
            rows={4}
            value={approach}
            onChange={(e) => setApproach(e.target.value)}
            placeholder={t('bid.approachPlaceholder')}
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
            ? t('bid.adjustBreakdown')
            : projectTemplateBreakdown
              ? t('bid.fillBreakdown')
              : t('bid.addBreakdown')}
        </label>
      </div>

      {showBreakdown && (
        <div className="bid-line-items">
          <p className="tag-section-label">
            {breakdownMode === 'adjust'
              ? t('bid.contractorBreakdown')
              : projectTemplateBreakdown
                ? t('bid.projectBreakdown')
                : t('bid.costBreakdownOptional')}
          </p>
          {breakdownMode === 'adjust' && (
            <p className="muted bid-line-items-hint">
              {t('bid.adjustBreakdownHint')}
            </p>
          )}
          {breakdownMode === 'create' && projectTemplateBreakdown && (
            <p className="muted bid-line-items-hint">
              {t('bid.templateBreakdownHint')}
            </p>
          )}
          <ul className="bid-line-items-list">
            {lineItems.map((item, index) => (
              <li key={index} className="bid-line-item-row">
                <input
                  type="text"
                  aria-label={t('common.trade')}
                  placeholder={t('bid.tradePlaceholder')}
                  value={item.trade}
                  onChange={(e) => {
                    const next = [...lineItems];
                    next[index] = { ...item, trade: e.target.value };
                    setLineItems(next);
                  }}
                />
                <input
                  type="text"
                  aria-label={t('common.descriptionOptional')}
                  placeholder={t('common.descriptionOptional')}
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
                  aria-label={t('common.amount')}
                  placeholder={t('bid.thbPlaceholder')}
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
                  aria-label={t('common.removeLine')}
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
            {t('common.addLine')}
          </button>
          {showBreakdown && activeLineItems.length > 0 && (
            <p className="muted bid-line-items-total">
              {t('bid.breakdownSubtotal', {
                amount: formatThb(breakdownSubtotal),
              })}
            </p>
          )}
          {breakdownMismatch && showBreakdown && (
            <p className="form-error bid-line-items-total-error" role="alert">
              {breakdownMismatchMessage}
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
            ? t('common.saving')
            : submitLabel ??
              (existingBid?.status === 'submitted'
                ? t('bid.updateProposal')
                : t('bid.submitProposal'))}
        </button>
        {footerExtra}
        {existingBid?.status === 'submitted' && onWithdraw && (
          <button
            type="button"
            className="secondary participation-toolbar-withdraw"
            disabled={busy}
            onClick={() => void onWithdraw()}
          >
            {t('common.withdraw')}
          </button>
        )}
      </div>
    </div>
  );
}
