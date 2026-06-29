'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CostBreakdownTemplateEditor } from '@/components/CostBreakdownTemplateEditor';
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

function emptyPreview(project: Project): TenderPublishPreview {
  return {
    scopeSummary:
      project.description?.trim() ||
      `Construction works for ${project.title}`,
    clarificationSummary: project.clarificationSummary,
    defaultCostBreakdown: [{ trade: '', description: '' }],
    contractTerms: {
      siteAddress: project.district ?? undefined,
      subjectOfContract:
        project.description?.trim() ||
        `Construction works for ${project.title}`,
    },
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
  const [preview, setPreview] = useState<TenderPublishPreview>(() =>
    emptyPreview(project),
  );
  const [deadline, setDeadline] = useState<ApplicationsDeadlineValue>(
    initialDeadline,
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDeadline(initialDeadline);
    setError(null);
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchTenderPublishPreview(projectId);
        setPreview({
          ...data,
          defaultCostBreakdown:
            data.defaultCostBreakdown.length > 0
              ? data.defaultCostBreakdown
              : [{ trade: '', description: '' }],
        });
      } catch (err: unknown) {
        setPreview(emptyPreview(project));
        setError(
          err instanceof Error ? err.message : 'Failed to load publish preview',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, projectId, project, initialDeadline]);

  if (!isOpen) {
    return null;
  }

  const setContractTerm = <K extends keyof BidContractTerms>(
    key: K,
    value: BidContractTerms[K],
  ) => {
    setPreview((current) => ({
      ...current,
      contractTerms: { ...current.contractTerms, [key]: value },
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
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
      setError(err instanceof Error ? err.message : 'Failed to publish tender');
    } finally {
      setSubmitting(false);
    }
  };

  const busy = loading || submitting;
  const title =
    mode === 'create'
      ? structuredQa
        ? 'Publish for clarification'
        : 'Publish for bids'
      : 'Open tender for bids';

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
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="muted modal-subtitle">
          Review and adjust the commercial proposal template before contractors
          receive the project.
        </p>

        <form className="modal-form" onSubmit={(e) => void handleSubmit(e)}>
          {loading ? (
            <p className="muted">Preparing template…</p>
          ) : (
            <>
              <TenderApplicationsDeadlineFields
                idPrefix="publish-package-deadline"
                value={deadline}
                disabled={busy}
                onChange={setDeadline}
              />

              <label>
                Scope
                <span className="field-hint muted">
                  Main scope description for the commercial proposal
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
                  Clarification summary
                  <span className="field-hint muted">
                    Shared with contractors in the commercial proposal
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

              <p className="tag-section-label">Contract document fields</p>

              <label>
                Subject of contract
                <textarea
                  rows={2}
                  disabled={busy}
                  value={preview.contractTerms.subjectOfContract ?? ''}
                  onChange={(e) =>
                    setContractTerm('subjectOfContract', e.target.value)
                  }
                />
              </label>

              <label>
                Site address
                <input
                  type="text"
                  disabled={busy}
                  value={preview.contractTerms.siteAddress ?? ''}
                  placeholder={project.district ?? 'Full property address'}
                  onChange={(e) => setContractTerm('siteAddress', e.target.value)}
                />
              </label>

              <label>
                Property ownership / site rights
                <textarea
                  rows={2}
                  disabled={busy}
                  value={preview.contractTerms.propertyOwnership ?? ''}
                  placeholder="Title deed, lease, developer consent, etc."
                  onChange={(e) =>
                    setContractTerm('propertyOwnership', e.target.value)
                  }
                />
              </label>

              <label>
                Employer address
                <input
                  type="text"
                  disabled={busy}
                  value={preview.contractTerms.employerAddress ?? ''}
                  onChange={(e) =>
                    setContractTerm('employerAddress', e.target.value)
                  }
                />
              </label>

              <label>
                Employer registration no.
                <input
                  type="text"
                  disabled={busy}
                  value={preview.contractTerms.employerRegistrationNo ?? ''}
                  onChange={(e) =>
                    setContractTerm('employerRegistrationNo', e.target.value)
                  }
                />
              </label>
            </>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="row">
            <button type="submit" className="primary" disabled={busy || loading}>
              {submitting
                ? 'Publishing…'
                : mode === 'create'
                  ? 'Publish tender'
                  : 'Open tender'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
