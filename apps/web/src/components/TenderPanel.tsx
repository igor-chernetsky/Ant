'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatThb } from '@/lib/estimate';
import type { Project } from '@/lib/projects';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import {
  createProjectTender,
  fetchProjectTender,
  formatTenderStatus,
  selectProjectBid,
  startProjectTender,
  type Bid,
  type Tender,
} from '@/lib/tendering';

interface TenderPanelProps {
  projectId: string;
  project: Project;
  onUpdated: (project: Project) => void;
}

export function TenderPanel({ projectId, project, onUpdated }: TenderPanelProps) {
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

  const handleStart = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await startProjectTender(projectId);
      setTender(data);
      await refreshProject();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start tender');
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

  if (loading) {
    return (
      <section className="card">
        <p className="muted">Loading tender…</p>
      </section>
    );
  }

  return (
    <section className="card tender-card">
      <h2 className="section-title">Tender &amp; bids</h2>
      <p className="muted doc-hint">
        Invite verified contractors, collect bids, and select a winner. Bids are
        visible only to you until a contractor is selected.
      </p>

      {error && <p className="form-error">{error}</p>}

      {!tender ? (
        <div className="tender-actions">
          <button
            type="button"
            className="primary"
            disabled={
              busy ||
              !['estimated', 'tender_ready'].includes(project.status)
            }
            onClick={() => void handleCreate()}
          >
            {busy ? 'Creating…' : 'Create tender & invite contractors'}
          </button>
          {project.status !== 'estimated' &&
            project.status !== 'tender_ready' && (
            <p className="muted tender-hint">
              Complete intake and receive a ballpark estimate first.
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
              <dt>Invitations</dt>
              <dd>
                {tender.acceptedInvitationCount} accepted /{' '}
                {tender.invitations.length} sent
              </dd>
            </div>
            <div>
              <dt>Bids received</dt>
              <dd>{tender.submittedBidCount}</dd>
            </div>
            {tender.closesAt && (
              <div>
                <dt>Closes</dt>
                <dd>{new Date(tender.closesAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>

          {(tender.status === 'draft' ||
            tender.status === 'collecting_participants') && (
            <div className="tender-actions">
              <button
                type="button"
                className="primary"
                disabled={busy || tender.acceptedInvitationCount < 1}
                onClick={() => void handleStart()}
              >
                {busy ? 'Opening…' : 'Open tender for bids'}
              </button>
              {tender.acceptedInvitationCount < 1 && (
                <p className="muted tender-hint">
                  Wait for at least one contractor to accept an invitation.
                  Contractors register at the Contractor portal link in the header.
                </p>
              )}
            </div>
          )}

          {tender.invitations.length > 0 && (
            <>
              <h3 className="tag-section-label">Invitations</h3>
              <ul className="tender-invite-list">
                {tender.invitations.map((inv) => (
                  <li key={inv.id} className="tender-invite-item">
                    <span>{inv.companyName ?? 'Contractor'}</span>
                    <span className="status-pill">{inv.status}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {(tender.status === 'open' ||
            tender.status === 'closed') && (
            <p className="muted tender-hint">
              {tender.status === 'open'
                ? 'Bidding is open. New bids are accepted until the deadline.'
                : 'Bidding closed. Compare bids below and select a winner.'}
            </p>
          )}

          {tender.bids.length > 0 && (
            <>
              <h3 className="tag-section-label">Bids &amp; proposals</h3>
              <ul className="bid-proposal-list">
                {tender.bids.map((bid) => (
                  <li key={bid.id} className="bid-proposal-list-item">
                    <BidProposalSummary
                      bid={bid}
                      ballparkMid={ballparkMid}
                    />
                    <div className="bid-line-actions bid-proposal-actions">
                      {(tender.status === 'open' ||
                        tender.status === 'closed') &&
                        bid.status === 'submitted' && (
                          <button
                            type="button"
                            className="primary"
                            disabled={busy}
                            onClick={() => void handleSelectBid(bid)}
                          >
                            Select this bid
                          </button>
                        )}
                      {bid.status === 'selected' && (
                        <span className="readiness-badge">Selected</span>
                      )}
                      {bid.status === 'rejected' && (
                        <span className="status-pill">Not selected</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tender.status === 'awarded' && tender.awardedBidId && (
            <p className="muted tender-hint">
              Tender awarded. Contract generation will be available in a future
              release.
            </p>
          )}
        </>
      )}
    </section>
  );
}
