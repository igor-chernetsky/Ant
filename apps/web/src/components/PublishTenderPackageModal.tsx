'use client';

import { FormEvent, useEffect, useState } from 'react';
import { BidContractTermsFields } from '@/components/BidContractTermsFields';
import { CostBreakdownTemplateEditor } from '@/components/CostBreakdownTemplateEditor';
import { useTranslation } from '@/components/LocaleProvider';
import {
  contractTermsFromProject,
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
  const [preview, setPreview] = useState<TenderPublishPreview>(() =>
    emptyPreview(project, t),
  );
  const [deadline, setDeadline] = useState<ApplicationsDeadlineValue>(
    initialDeadline,
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClarificationPublish = mode === 'create' && structuredQa;

  useEffect(() => {
    if (!isOpen) return;
    setDeadline(initialDeadline);
    setError(null);
    if (isClarificationPublish) {
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchTenderPublishPreview(projectId);
        setPreview({
          ...data,
          contractTerms: contractTermsFromProject({
            contractTerms: data.contractTerms,
            project: buildProjectContext(project),
          }),
          defaultCostBreakdown:
            data.defaultCostBreakdown.length > 0
              ? data.defaultCostBreakdown
              : [{ trade: '', description: '' }],
        });
      } catch (err: unknown) {
        setPreview(emptyPreview(project, t));
        setError(
          err instanceof Error
            ? err.message
            : t('tenderCard.loadPreviewFailed'),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, isClarificationPublish, projectId, project, initialDeadline, t]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
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
      } else {
        await startProjectTender(projectId, payload);
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

  const busy = loading || submitting;
  const title =
    mode === 'create'
      ? structuredQa
        ? t('tenderCard.publishForClarification')
        : t('tenderCard.publishForBids')
      : t('tenderCard.openTenderForBids');

  return (
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

        <p className="muted modal-subtitle">
          {isClarificationPublish
            ? t('tenderCard.modalSubtitleClarification')
            : t('tenderCard.modalSubtitle')}
        </p>

        <form className="modal-form" onSubmit={(e) => void handleSubmit(e)}>
          {loading ? (
            <p className="muted">{t('tenderCard.preparingTemplate')}</p>
          ) : (
            <>
              <TenderApplicationsDeadlineFields
                idPrefix="publish-package-deadline"
                value={deadline}
                disabled={busy}
                onChange={setDeadline}
              />

              {isClarificationPublish && (
                <p className="muted publish-clarification-hint">
                  {t('tenderCard.modalClarificationPublishHint')}
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
                    }))
                  }
                />
              </label>

              {(structuredQa || preview.clarificationSummary) && (
                <label>
                  {t('tenderCard.clarificationSummary')}
                  <span className="field-hint muted">
                    {t('tenderCard.clarificationSummaryHint')}
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
                onChange={(defaultCostBreakdown) =>
                  setPreview((current) => ({ ...current, defaultCostBreakdown }))
                }
              />

              <label>
                {t('tenderCard.subjectOfContract')}
                <span className="field-hint muted">
                  {t('tenderCard.subjectOfContractHint')}
                </span>
                <textarea
                  rows={2}
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
              </label>

              <BidContractTermsFields
                value={preview.contractTerms}
                onChange={(contractTerms) =>
                  setPreview((current) => ({ ...current, contractTerms }))
                }
                audience="client"
                projectTitle={project.title}
                projectDistrict={project.district}
                disabled={busy}
                hideSubjectOfContract
              />
              </>
              )}
            </>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="row">
            <button type="submit" className="primary" disabled={busy || loading}>
              {submitting
                ? t('tenderCard.publishing')
                : mode === 'create'
                  ? t('tenderCard.publishTender')
                  : t('tenderCard.openTender')}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
