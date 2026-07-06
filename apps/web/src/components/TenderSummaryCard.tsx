'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatThb } from '@/lib/estimate';
import type { Project } from '@/lib/projects';
import {
  fetchProjectTender,
  formatTenderStatus,
  revertProjectTender,
  updateTenderDeadline,
  type Tender,
} from '@/lib/tendering';
import { ClientClarificationQuestionsPanel } from '@/components/ClientClarificationQuestionsPanel';
import { ContractorCoverageNotice } from '@/components/ContractorCoverageNotice';
import { PublishTenderPackageModal } from '@/components/PublishTenderPackageModal';
import {
  applicationsDeadlineFromTender,
  applicationsDeadlineToPayload,
  defaultApplicationsCloseDateString,
  TenderApplicationsDeadlineFields,
  type ApplicationsDeadlineValue,
} from '@/components/TenderApplicationsDeadlineFields';

interface TenderSummaryCardProps {
  projectId: string;
  project: Project;
  onUpdated: (project: Project) => void;
}

function canPublishProject(project: Project): boolean {
  return ['estimated', 'in_tender'].includes(project.status);
}

function formatDeadlineLabel(tender: Tender): string {
  if (tender.noApplicationsDeadline || !tender.closesAt) {
    return 'No time limit';
  }
  return new Date(tender.closesAt).toLocaleString();
}

export function TenderSummaryCard({
  projectId,
  project,
  onUpdated,
}: TenderSummaryCardProps) {
  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishDeadline, setPublishDeadline] = useState<ApplicationsDeadlineValue>(
    () => ({
      applicationsCloseAt: defaultApplicationsCloseDateString(),
      noApplicationsDeadline: false,
    }),
  );
  const [extendDeadline, setExtendDeadline] = useState<ApplicationsDeadlineValue>(
    () => ({
      applicationsCloseAt: defaultApplicationsCloseDateString(),
      noApplicationsDeadline: false,
    }),
  );
  const [publishModalMode, setPublishModalMode] = useState<
    'create' | 'start' | null
  >(null);

  const loadTender = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectTender(projectId);
      setTender(data);
      if (data) {
        setExtendDeadline(applicationsDeadlineFromTender(data));
        if (data.status === 'draft') {
          setPublishDeadline(applicationsDeadlineFromTender(data));
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tender');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadTender();
  }, [loadTender]);

  const refreshProject = async () => {
    const { fetchProject } = await import('@/lib/projects');
    const updated = await fetchProject(projectId);
    onUpdated(updated);
  };

  const handleCreate = async () => {
    setPublishModalMode('create');
  };

  const handleOpenTender = async () => {
    setPublishModalMode('start');
  };

  const handlePublishComplete = async () => {
    await loadTender();
    await refreshProject();
  };

  const handleExtendDeadline = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await updateTenderDeadline(
        projectId,
        applicationsDeadlineToPayload(extendDeadline),
      );
      setTender(data);
      setExtendDeadline(applicationsDeadlineFromTender(data));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to update application deadline',
      );
    } finally {
      setBusy(false);
    }
  };

  const structuredQa = project.clarificationMode === 'structured_qa';
  const tagKey = project.tags.map((tag) => tag.slug).join(',');
  const collectingQuestions = structuredQa && tender?.status === 'draft';
  const canPublish = canPublishProject(project);
  const canRevert =
    tender != null &&
    (tender.status === 'open' || tender.status === 'draft') &&
    (tender.applicationCount ?? tender.bids.length) === 0;
  const bidsHref = `/projects/${projectId}/bids`;
  const deadlineExpired = Boolean(tender?.applicationsDeadlinePassed);

  const handleRevert = async () => {
    const confirmed = window.confirm(
      'Return this project to preparation? Contractors will no longer see it for bidding until you publish again.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await revertProjectTender(projectId);
      setTender(null);
      await refreshProject();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revert tender');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="card tender-card">
        <p className="muted">Loading tender…</p>
      </section>
    );
  }

  return (
    <section className="card tender-card tender-summary-card">
      <div className="tender-card-header">
        <h2 className="section-title">Tender &amp; bids</h2>
        {tender && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void loadTender()}
          >
            Refresh
          </button>
        )}
      </div>

      {error && <p className="form-error tender-error">{error}</p>}

      {!tender ? (
        <>
          <p className="muted doc-hint">
            {structuredQa
              ? 'Publish to collect contractor clarification questions. Answer what you can, then open the tender for commercial proposals.'
              : 'Publish the project for open bidding. Contractors clarify scope, enroll as contenders, then submit proposals.'}
          </p>
          <div className="tender-actions-block tender-publish-block">
            <ContractorCoverageNotice
              projectId={projectId}
              enabled={canPublish}
              tagKey={tagKey}
            />
            <button
              type="button"
              className="primary"
              disabled={busy || !canPublish}
              onClick={() => void handleCreate()}
            >
              {structuredQa ? 'Publish for clarification' : 'Publish for bids'}
            </button>
            {!canPublish && (
              <p className="muted tender-hint">
                Complete intake and receive a ballpark estimate first.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <dl className="meta-grid tender-meta tender-summary-meta">
            <div>
              <dt>Status</dt>
              <dd>
                {collectingQuestions
                  ? 'Collecting questions'
                  : formatTenderStatus(tender.status)}
              </dd>
            </div>
            <div>
              <dt>Applications</dt>
              <dd>{tender.applicationCount ?? tender.bids.length}</dd>
            </div>
            {(tender.submittedBidCount ?? 0) > 0 && (
              <div>
                <dt>Proposals</dt>
                <dd>{tender.submittedBidCount}</dd>
              </div>
            )}
            <div>
              <dt>Applications close</dt>
              <dd>{formatDeadlineLabel(tender)}</dd>
            </div>
          </dl>

          {deadlineExpired && tender.status !== 'awarded' && (
            <div className="tender-deadline-expired">
              <p className="tender-deadline-expired-lead">
                The application deadline has passed. You received{' '}
                <strong>{tender.applicationCount ?? tender.bids.length}</strong>{' '}
                {(tender.applicationCount ?? tender.bids.length) === 1
                  ? 'application'
                  : 'applications'}
                {(tender.submittedBidCount ?? 0) > 0 && (
                  <>
                    {' '}
                    and <strong>{tender.submittedBidCount}</strong>{' '}
                    {tender.submittedBidCount === 1 ? 'proposal' : 'proposals'}
                  </>
                )}
                . Review current bids or extend the deadline if you need more
                applications.
              </p>
              <div className="tender-deadline-extend">
                <TenderApplicationsDeadlineFields
                  idPrefix="extend-deadline"
                  value={extendDeadline}
                  disabled={busy}
                  onChange={setExtendDeadline}
                />
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => void handleExtendDeadline()}
                >
                  {busy ? 'Saving…' : 'Extend deadline'}
                </button>
              </div>
            </div>
          )}

          {tender.bids.length > 0 && (
            <div className="tender-summary-actions">
              <p className="muted tender-summary-lead">
                {tender.status === 'awarded' && tender.awardedBidId ? (
                  'Tender awarded. Review applications and the selected contractor.'
                ) : tender.submittedBidCount > 0 ? (
                  <>
                    {tender.applicationCount ?? tender.bids.length}{' '}
                    {(tender.applicationCount ?? tender.bids.length) === 1
                      ? 'application'
                      : 'applications'}
                    , {tender.submittedBidCount}{' '}
                    {tender.submittedBidCount === 1 ? 'proposal' : 'proposals'}{' '}
                    to review.
                    {(() => {
                      const amounts = tender.bids
                        .filter((b) => b.status === 'submitted' && b.amount != null)
                        .map((b) => Number(b.amount));
                      if (amounts.length === 0) return null;
                      return (
                        <>
                          {' '}
                          Lowest offer {formatThb(Math.min(...amounts))}.
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    {tender.applicationCount ?? tender.bids.length}{' '}
                    {(tender.applicationCount ?? tender.bids.length) === 1
                      ? 'application'
                      : 'applications'}{' '}
                    in progress. Waiting for commercial proposals.
                  </>
                )}
              </p>
              <Link href={bidsHref} className="primary tender-summary-cta">
                {tender.status === 'awarded'
                  ? 'Review bids'
                  : 'View & compare bids'}
              </Link>
            </div>
          )}

          {collectingQuestions && (
            <div className="tender-actions-block tender-publish-block">
              <p className="muted tender-phase-hint">
                Contractors are submitting clarification questions. Answer any
                you are ready to — you do not need to answer all of them before
                opening the tender.
              </p>
              <ContractorCoverageNotice
                projectId={projectId}
                enabled={canPublish}
                tagKey={tagKey}
              />
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => void handleOpenTender()}
              >
                Open tender for bids
              </button>
            </div>
          )}

          {tender.bids.length === 0 && !collectingQuestions && (
            <>
              <p className="muted tender-phase-hint">
                Published for bids. Waiting for contractors to start clarification.
              </p>
              {canRevert && (
                <div className="tender-actions-block">
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void handleRevert()}
                  >
                    {busy ? 'Returning…' : 'Return to preparation'}
                  </button>
                  <p className="muted tender-hint">
                    Unpublish to refine project details before contractors apply.
                  </p>
                </div>
              )}
            </>
          )}

          {project.clarificationMode === 'structured_qa' && tender && (
            <ClientClarificationQuestionsPanel
              projectId={projectId}
              tenderStatus={tender.status}
              clarificationSummary={project.clarificationSummary}
              onUpdated={() => void refreshProject()}
            />
          )}
        </>
      )}

      {publishModalMode && (
        <PublishTenderPackageModal
          projectId={projectId}
          project={project}
          mode={publishModalMode}
          structuredQa={structuredQa}
          deadline={publishDeadline}
          isOpen
          onClose={() => setPublishModalMode(null)}
          onPublished={handlePublishComplete}
        />
      )}
    </section>
  );
}
