'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatThb } from '@/lib/estimate';
import type { Project } from '@/lib/projects';
import { BidApplicationCard } from '@/components/BidApplicationCard';
import { useSession } from '@/components/SessionProvider';
import {
  createProjectTender,
  fetchProjectTender,
  formatTenderStatus,
  selectProjectBid,
  type Bid,
  type Tender,
} from '@/lib/tendering';

interface TenderPanelProps {
  projectId: string;
  project: Project;
  onUpdated: (project: Project) => void;
}

function canPublishProject(project: Project): boolean {
  return ['estimated', 'in_tender'].includes(project.status);
}

export function TenderPanel({ projectId, project, onUpdated }: TenderPanelProps) {
  const { me } = useSession();
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

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadTender();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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

  const handleSelectBid = async (bid: Bid) => {
    const confirmed = window.confirm(
      `Select bid from ${bid.companyName ?? 'contractor'} for ${formatThb(Number(bid.amount))}?`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const data = await selectProjectBid(projectId, bid.id);
      setTender(data);
      await refreshProject();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to select bid');
    } finally {
      setBusy(false);
    }
  };

  const ballparkMid = project.estimate?.totals.midAmount ?? null;
  const canPublish = canPublishProject(project);

  if (loading) {
    return (
      <section className="card">
        <p className="muted">Loading tender…</p>
      </section>
    );
  }

  return (
    <section className="card tender-card">
      <div className="tender-card-header">
        <h2 className="section-title">Tender &amp; bids</h2>
        {tender && (
          <button
            type="button"
            className="secondary"
            disabled={busy || loading}
            onClick={() => void loadTender()}
          >
            Refresh
          </button>
        )}
      </div>
      <p className="muted doc-hint">
        Publish the project for open bidding. Contractors can view the project
        and submit applications with an internal chat for questions.
      </p>

      {error && <p className="form-error tender-error">{error}</p>}

      {!tender ? (
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
          {project.status === 'in_tender' && (
            <p className="muted tender-hint">
              This project is marked as in tender but bidding data was missing.
              Click &quot;Publish for bids&quot; to restore the tender.
            </p>
          )}
        </div>
      ) : (
        <>
          <dl className="meta-grid tender-meta">
            <div>
              <dt>Status</dt>
              <dd>{formatTenderStatus(tender.status)}</dd>
            </div>
            <div>
              <dt>Applications received</dt>
              <dd>{tender.submittedBidCount}</dd>
            </div>
            {tender.closesAt ? (
              <div>
                <dt>Closes</dt>
                <dd>{new Date(tender.closesAt).toLocaleString()}</dd>
              </div>
            ) : (
              <div>
                <dt>Deadline</dt>
                <dd>Starts when the first application arrives</dd>
              </div>
            )}
          </dl>

          {tender.status === 'open' && (
            <p className="muted tender-phase-hint">
              {tender.closesAt
                ? 'Bidding is open. New applications are accepted until the deadline.'
                : 'Published for bids. The deadline starts when the first contractor applies.'}
            </p>
          )}
          {tender.status === 'closed' && (
            <p className="muted tender-phase-hint">
              Bidding closed. Compare applications below and select a winner.
            </p>
          )}

          {tender.bids.length > 0 ? (
            <div className="tender-subsection">
              <h3 className="tender-subsection-title">Applications</h3>
              <ul className="bid-proposal-list">
                {tender.bids.map((bid) => (
                  <BidApplicationCard
                    key={bid.id}
                    bid={bid}
                    ballparkMid={ballparkMid}
                    tenderStatus={tender.status}
                    busy={busy}
                    currentUserId={me?.id}
                    projectId={projectId}
                    onSelect={handleSelectBid}
                  />
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted tender-phase-hint">
              No applications yet. Contractors can submit bids from the project
              page. Use Refresh after a contractor applies.
            </p>
          )}

          {tender.status === 'awarded' && tender.awardedBidId && (
            <p className="muted tender-phase-hint">
              Tender awarded. Contract generation will be available in a future
              release.
            </p>
          )}
        </>
      )}
    </section>
  );
}
