'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatThb } from '@/lib/estimate';
import type { Project } from '@/lib/projects';
import {
  createProjectTender,
  fetchProjectTender,
  formatTenderStatus,
  revertProjectTender,
  type Tender,
} from '@/lib/tendering';

interface TenderSummaryCardProps {
  projectId: string;
  project: Project;
  onUpdated: (project: Project) => void;
}

function canPublishProject(project: Project): boolean {
  return ['estimated', 'in_tender'].includes(project.status);
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

  const loadTender = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectTender(projectId);
      setTender(data);
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
    setBusy(true);
    setError(null);
    try {
      const data = await createProjectTender(projectId);
      setTender(data);
      await refreshProject();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create tender');
    } finally {
      setBusy(false);
    }
  };

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

  const canPublish = canPublishProject(project);
  const canRevert =
    tender != null &&
    tender.status === 'open' &&
    (tender.applicationCount ?? tender.bids.length) === 0;
  const bidsHref = `/projects/${projectId}/bids`;

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
            Publish the project for open bidding. Contractors clarify scope,
            enroll as contenders, then submit proposals.
          </p>
          <div className="tender-actions-block">
            <button
              type="button"
              className="primary"
              disabled={busy || !canPublish}
              onClick={() => void handleCreate()}
            >
              {busy ? 'Publishing…' : 'Publish for bids'}
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
              <dd>{formatTenderStatus(tender.status)}</dd>
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
            {tender.closesAt ? (
              <div>
                <dt>Closes</dt>
                <dd>{new Date(tender.closesAt).toLocaleString()}</dd>
              </div>
            ) : (
              <div>
                <dt>Deadline</dt>
                <dd>Starts with first application</dd>
              </div>
            )}
          </dl>

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

          {tender.bids.length === 0 && (
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
        </>
      )}
    </section>
  );
}
