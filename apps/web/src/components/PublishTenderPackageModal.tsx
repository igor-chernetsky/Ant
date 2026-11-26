'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AntSpinner, BusyLabel } from '@/components/AntSpinner';
import { BidContractTermsFields } from '@/components/BidContractTermsFields';
import { EmployerLegalFields } from '@/components/EmployerLegalFields';
import { CostBreakdownTemplateEditor } from '@/components/CostBreakdownTemplateEditor';
import { useTranslation } from '@/components/LocaleProvider';
import { useSession } from '@/components/SessionProvider';
import {
  contractTermsFromProject,
  hasCompleteEmployerLegalDetails,
  missingEmployerLegalFields,
  type ContractTermsProjectContext,
} from '@/lib/contract-terms-fields';
import {
  applicationsDeadlineToPayload,
  TenderApplicationsDeadlineFields,
  type ApplicationsDeadlineValue,
} from '@/components/TenderApplicationsDeadlineFields';
import {
  createProjectTender,
  fetchTenderPublishPreview,
  startProjectTender,
  type BidContractTerms,
  type DefaultCostBreakdownItem,
  type TenderPublishPreview,
} from '@/lib/tendering';
import type { Project } from '@/lib/projects';
import type { TranslateFn } from '@/lib/i18n/formatters';
import { AnalyticsEvents, trackEvent } from '@/lib/analytics';

export interface PublishTenderPackageInput {
  scopeSummary: string;
  clarificationSummary: string;
  defaultCostBreakdown: DefaultCostBreakdownItem[];
  contractTerms: BidContractTerms;
  deadline: ApplicationsDeadlineValue;
}

interface PublishTenderPackageModalProps {
  projectId: string;
  project: Project;
  mode: 'create' | 'start';
  structuredQa: boolean;
  deadline: ApplicationsDeadlineValue;
  isOpen: boolean;
  onClose: () => void;
  onPublished: () => void | Promise<void>;
}

function buildProjectContext(project: Project): ContractTermsProjectContext {
  return {
    title: project.title,
    district: project.district,
    description: project.description,
    brief: project.brief ?? null,
  };
}

function emptyPreview(
  project: Project,
  t: TranslateFn,
): TenderPublishPreview {
  return {
    scopeSummary:
      project.description?.trim() ||
      t('tenderCard.constructionWorksFor', { title: project.title }),
    clarificationSummary: project.clarificationSummary,
    defaultCostBreakdown: [{ trade: '', description: '' }],
    contractTerms: contractTermsFromProject({
      project: buildProjectContext(project),
    }),
  };
}

export function PublishTenderPackageModal({
  projectId,
  project,
  mode,
  structuredQa,
  deadline: initialDeadline,
  isOpen,
  onClose,
  onPublished,
}: PublishTenderPackageModalProps) {
  const { t } = useTranslation();
  const { me } = useSession();
  /**
   * P7: the employer's legal details are usually the client's own profile data, so
   * they are prefilled and the "Your details" step is one glance and Next.
   */
  const withProfileDetails = (terms: BidContractTerms): BidContractTerms => ({
    ...terms,
    employerName:
      terms.employerName?.trim() ||
      me?.companyName?.trim() ||
      me?.displayName?.trim() ||
      undefined,
  });
  const [preview, setPreview] = useState<TenderPublishPreview>(() =>
    emptyPreview(project, t),
  );
  const [deadline, setDeadline] = useState<ApplicationsDeadlineValue>(
    initialDeadline,
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  /**
   * The form used to be ~25 fields in one scroll. It is now three steps: the tender
   * itself, the contract terms, then a review before publishing.
   */
  const [step, setStep] = useState(1);
  /** Subject of contract mirrors the scope until the client edits it. */
  const [subjectSameAsScope, setSubjectSameAsScope] = useState(true);
  /**
   * Contract terms start collapsed as a summary of the defaults: most clients keep
   * 10% retention and 24 months of warranty and never need the full field set.
   */
  const [showTermsFields, setShowTermsFields] = useState(false);
  /** V3: red marks appear only after the first failed Next, not on a fresh step. */
  const [detailsAttempted, setDetailsAttempted] = useState(false);

  const isDesign = project.projectType === 'design';
  const isClarificationPublish = mode === 'create' && structuredQa;

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Load preview once per open session. Do not depend on `project` / `t` /
  // `initialDeadline` object identity — parent re-renders were remounting the
  // form mid-edit and wiping in-progress KP fields.
  useEffect(() => {
    if (!isOpen) return;

    setDeadline(initialDeadline);
    setError(null);
    setStep(1);
    setSubjectSameAsScope(true);
    setShowTermsFields(false);
    setDetailsAttempted(false);
    if (isClarificationPublish) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchTenderPublishPreview(projectId);
        if (cancelled) return;
        setPreview({
          ...data,
          contractTerms: withProfileDetails(
            contractTermsFromProject({
              contractTerms: data.contractTerms,
              project: buildProjectContext(project),
            }),
          ),
          defaultCostBreakdown:
            data.defaultCostBreakdown.length > 0
              ? data.defaultCostBreakdown
              : [{ trade: '', description: '' }],
        });
      } catch (err: unknown) {
        if (cancelled) return;
        const fallback = emptyPreview(project, t);
        setPreview({
          ...fallback,
          contractTerms: withProfileDetails(fallback.contractTerms),
        });
        setError(
          err instanceof Error
            ? err.message
            : t('tenderCard.loadPreviewFailed'),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: open/projectId only
  }, [isOpen, isClarificationPublish, projectId]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen || !portalReady) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (
        !isClarificationPublish &&
        !hasCompleteEmployerLegalDetails(preview.contractTerms)
      ) {
        setError(t('contractTerms.employerLegalRequired'));
        setSubmitting(false);
        return;
      }

      const payload = isClarificationPublish
        ? applicationsDeadlineToPayload(deadline)
        : {
            ...applicationsDeadlineToPayload(deadline),
            scopeSummary: preview.scopeSummary,
            clarificationSummary: preview.clarificationSummary ?? undefined,
            defaultCostBreakdown: preview.defaultCostBreakdown.filter((item) =>
              item.trade.trim(),
            ),
            contractTerms: preview.contractTerms,
          };

      if (mode === 'create') {
        await createProjectTender(projectId, payload);
        trackEvent(
          isClarificationPublish
            ? AnalyticsEvents.publishForClarification
            : AnalyticsEvents.publishForBids,
          {
            project_id: projectId,
            project_type: project.projectType,
            clarification_mode: structuredQa ? 'structured_qa' : 'open_chat',
          },
        );
      } else {
        await startProjectTender(projectId, payload);
        trackEvent(AnalyticsEvents.openTenderForBids, {
          project_id: projectId,
          project_type: project.projectType,
        });
      }
      await onPublished();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('tenderCard.publishFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Tender → Contract terms → Your details → Review (2 steps for clarification). */
  const stepCount = isClarificationPublish ? 2 : 4;
  const detailsStep = isClarificationPublish ? 0 : 3;

  const goNext = () => {
    setError(null);
    if (step === 1 && !isClarificationPublish && !preview.scopeSummary.trim()) {
      setError(t('tenderCard.scopeRequired'));
      return;
    }
    if (
      detailsStep > 0 &&
      step === detailsStep &&
      !hasCompleteEmployerLegalDetails(preview.contractTerms)
    ) {
      /**
       * V3: the same sentence used to appear three times (top of the step, under the
       * fields and in the footer). Now the field carries its own message and the step
       * summary only appears when more than one field is empty.
       */
      setDetailsAttempted(true);
      const missing = missingEmployerLegalFields(preview.contractTerms);
      const firstMissing = missing[0];
      setError(
        missing.length > 1
          ? t('tenderCard.requiredLegalFields', {
              count: String(missing.length),
            })
          : null,
      );
      /** Ids live on the "Your details" step, so focus lands on the right input. */
      const fieldIdByField: Record<string, string> = {
        employerName: 'bid-terms-employer-name',
        employerAddress: 'bid-terms-employer-address',
        employerRegistrationNo: 'bid-terms-employer-registration',
      };
      if (firstMissing) {
        window.setTimeout(() => {
          const element = document.getElementById(
            fieldIdByField[firstMissing] ?? 'bid-terms-employer-name',
          );
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (element as HTMLInputElement | null)?.focus({ preventScroll: true });
        }, 60);
      }
      return;
    }
    setStep((current) => Math.min(stepCount, current + 1));
  };

  const goBack = () => {
    setError(null);
    setDetailsAttempted(false);
    setStep((current) => Math.max(1, current - 1));
  };

  const busy = loading || submitting;
  const title =
    mode === 'create'
      ? structuredQa
        ? t('tenderCard.publishForClarification')
        : t('tenderCard.publishForBids')
      : t('tenderCard.openTenderForBids');

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal modal--wide publish-tender-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-tender-title"
      >
        <div className="publish-tender-modal-chrome">
          <div className="modal-header">
            <h2 id="publish-tender-title">{title}</h2>
            <button
              type="button"
              className="icon-button"
              aria-label={t('common.close')}
              disabled={busy}
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <p className="muted modal-subtitle publish-tender-modal-subtitle">
            {isClarificationPublish
              ? t(
                  isDesign
                    ? 'tenderCard.modalSubtitleClarificationDesign'
                    : 'tenderCard.modalSubtitleClarification',
                )
              : t(
                  isDesign
                    ? 'tenderCard.modalSubtitleDesign'
                    : 'tenderCard.modalSubtitle',
                )}
          </p>
        </div>

        <form
          className="publish-tender-modal-form"
          onSubmit={(e) => void handleSubmit(e)}
        >
          {!loading && (
            <ol className="publish-steps" aria-label={t('tenderCard.publishSteps')}>
              {[
                t('tenderCard.stepTender'),
                ...(isClarificationPublish
                  ? []
                  : [t('tenderCard.stepTerms'), t('tenderCard.stepDetails')]),
                t('tenderCard.stepReview'),
              ].map((label, index) => {
                const number = index + 1;
                return (
                  <li
                    key={label}
                    className={`publish-step${
                      number === step ? ' publish-step--active' : ''
                    }${number < step ? ' publish-step--done' : ''}`}
                    aria-current={number === step ? 'step' : undefined}
                  >
                    <span className="publish-step-number">{number}</span>
                    <span className="publish-step-label">{label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="publish-tender-modal-body modal-form">
            {loading ? (
              <p className="muted contract-signing-loading">
                <AntSpinner
                  size="md"
                  label={t('tenderCard.preparingTemplate')}
                />
                <span>{t('tenderCard.preparingTemplate')}</span>
              </p>
            ) : (
              <>
                {step === 1 && (
                  <>
                    <TenderApplicationsDeadlineFields
                      idPrefix="publish-package-deadline"
                      value={deadline}
                      disabled={busy}
                      onChange={setDeadline}
                    />

                    {isClarificationPublish && (
                      <p className="muted publish-clarification-hint">
                        {t(
                          isDesign
                            ? 'tenderCard.modalClarificationPublishHintDesign'
                            : 'tenderCard.modalClarificationPublishHint',
                        )}
                      </p>
                    )}

                    {!isClarificationPublish && (
                      <>
                        <label>
                          {t('tenderCard.scope')}
                          <span className="field-hint muted">
                            {t('tenderCard.scopeHint')}
                          </span>
                          <textarea
                            rows={3}
                            disabled={busy}
                            value={preview.scopeSummary}
                            onChange={(e) =>
                              setPreview((current) => ({
                                ...current,
                                scopeSummary: e.target.value,
                                contractTerms: subjectSameAsScope
                                  ? {
                                      ...current.contractTerms,
                                      subjectOfContract: e.target.value,
                                    }
                                  : current.contractTerms,
                              }))
                            }
                          />
                        </label>

                        {(structuredQa || preview.clarificationSummary) && (
                          <label>
                            {t('tenderCard.clarificationSummary')}
                            <span className="field-hint muted">
                              {t(
                                isDesign
                                  ? 'tenderCard.clarificationSummaryHintDesign'
                                  : 'tenderCard.clarificationSummaryHint',
                              )}
                            </span>
                            <textarea
                              rows={4}
                              disabled={busy}
                              value={preview.clarificationSummary ?? ''}
                              onChange={(e) =>
                                setPreview((current) => ({
                                  ...current,
                                  clarificationSummary: e.target.value,
                                }))
                              }
                            />
                          </label>
                        )}

                        <CostBreakdownTemplateEditor
                          items={preview.defaultCostBreakdown}
                          disabled={busy}
                          isDesign={isDesign}
                          onChange={(defaultCostBreakdown) =>
                            setPreview((current) => ({
                              ...current,
                              defaultCostBreakdown,
                            }))
                          }
                        />
                      </>
                    )}
                  </>
                )}

                {step === 2 && !isClarificationPublish && (
                  <>
                    <div className="publish-subject-field">
                      <span className="publish-field-label">
                        {t('tenderCard.subjectOfContract')}
                      </span>
                      <label className="publish-same-scope">
                        <input
                          type="checkbox"
                          checked={subjectSameAsScope}
                          disabled={busy}
                          onChange={(e) => {
                            const same = e.target.checked;
                            setSubjectSameAsScope(same);
                            if (same) {
                              setPreview((current) => ({
                                ...current,
                                contractTerms: {
                                  ...current.contractTerms,
                                  subjectOfContract: current.scopeSummary,
                                },
                              }));
                            }
                          }}
                        />
                        <span>{t('tenderCard.sameAsScope')}</span>
                      </label>
                      {!subjectSameAsScope && (
                        <textarea
                          rows={3}
                          disabled={busy}
                          value={preview.contractTerms.subjectOfContract ?? ''}
                          onChange={(e) =>
                            setPreview((current) => ({
                              ...current,
                              contractTerms: {
                                ...current.contractTerms,
                                subjectOfContract: e.target.value,
                              },
                            }))
                          }
                        />
                      )}
                    </div>

                    {showTermsFields ? (
                      <>
                        <BidContractTermsFields
                          idPrefix="bid-terms"
                          value={preview.contractTerms}
                          onChange={(contractTerms) =>
                            setPreview((current) => ({
                              ...current,
                              contractTerms,
                            }))
                          }
                          audience="client"
                          projectTitle={project.title}
                          projectDistrict={project.district}
                          disabled={busy}
                          hideSubjectOfContract
                          hideEmployerLegal
                          isDesign={project.projectType === 'design'}
                        />
                        <button
                          type="button"
                          className="text-link"
                          disabled={busy}
                          onClick={() => setShowTermsFields(false)}
                        >
                          {t('tenderCard.hideTermsFields')}
                        </button>
                      </>
                    ) : (
                      <div className="publish-terms-summary">
                        <p className="muted">
                          {t('tenderCard.termsSummary', {
                            retention: String(
                              preview.contractTerms.retentionPercent ?? 10,
                            ),
                            warranty: String(
                              preview.contractTerms.defectNotificationMonths ?? 24,
                            ),
                            advance: String(
                              preview.contractTerms.advancePaymentPercent ?? 0,
                            ),
                          })}
                        </p>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => setShowTermsFields(true)}
                        >
                          {t('tenderCard.customizeTerms')}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {detailsStep > 0 && step === detailsStep && (
                  <>
                    {detailsAttempted &&
                      missingEmployerLegalFields(preview.contractTerms).length >
                        1 && (
                        <p className="publish-required-status" role="status">
                          <span aria-hidden>⚠</span>{' '}
                          {t('tenderCard.requiredLegalFields', {
                            count: String(
                              missingEmployerLegalFields(preview.contractTerms)
                                .length,
                            ),
                          })}
                        </p>
                      )}
                    <EmployerLegalFields
                      value={preview.contractTerms}
                      disabled={busy}
                      showInvalid={detailsAttempted}
                      onChange={(contractTerms) =>
                        setPreview((current) => ({
                          ...current,
                          contractTerms,
                        }))
                      }
                    />
                  </>
                )}

                {step === stepCount && (
                  <div className="publish-review">
                    <h3 className="publish-review-title">
                      {t('tenderCard.reviewTitle')}
                    </h3>
                    <p className="muted">{t('tenderCard.reviewHint')}</p>
                    <dl className="publish-review-list">
                      <div>
                        <dt>{t('tenderCard.scope')}</dt>
                        <dd>{preview.scopeSummary.trim() || t('common.dash')}</dd>
                      </div>
                      {!isClarificationPublish && (
                        <div>
                          <dt>{t('tenderCard.stepDetails')}</dt>
                          <dd>
                            {preview.contractTerms.employerName?.trim() ||
                              t('common.dash')}
                            {preview.contractTerms.employerAddress?.trim()
                              ? ` · ${preview.contractTerms.employerAddress.trim()}`
                              : ''}
                          </dd>
                        </div>
                      )}
                      {!isClarificationPublish && (
                        <div>
                          <dt>{t('tenderCard.defaultCostBreakdownTitle')}</dt>
                          <dd>
                            {preview.defaultCostBreakdown.filter((item) =>
                              item.trade.trim(),
                            ).length || t('common.dash')}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt>{t('tenderCard.subjectOfContract')}</dt>
                        <dd>
                          {preview.contractTerms.subjectOfContract?.trim() ||
                            t('common.dash')}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </>
            )}

            {error && <p className="form-error">{error}</p>}
          </div>

          {error && step > 1 ? (
            <p className="form-error publish-footer-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="publish-tender-modal-footer row publish-footer">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            <div className="publish-footer-main">
              {step > 1 && (
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={goBack}
                >
                  {t('common.back')}
                </button>
              )}
              {step < stepCount ? (
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={goNext}
                >
                  {t('common.next')}
                </button>
              ) : (
                <button
                  type="submit"
                  className="primary"
                  disabled={busy}
                  aria-busy={submitting}
                >
                  <BusyLabel
                    busy={submitting}
                    idle={
                      mode === 'create'
                        ? t('tenderCard.publishTender')
                        : t('tenderCard.openTender')
                    }
                    busyText={t('tenderCard.publishing')}
                  />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
