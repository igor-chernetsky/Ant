'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatThb } from '@/lib/estimate';
import type { Project } from '@/lib/projects';
import {
  formatProjectType,
} from '@/lib/projects';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import {
  createProjectTender,
  fetchProjectTender,
  formatInvitationStatus,
  formatTenderStatus,
  invitationStatusClass,
  selectProjectBid,
  startProjectTender,
  TENDER_INVITATION_LIMIT,
  type Bid,
  type Tender,
  type TenderInvitationStatus,
} from '@/lib/tendering';

interface TenderPanelProps {
  projectId: string;
  project: Project;
  onUpdated: (project: Project) => void;
}

function countByInvitationStatus(
  invitations: Tender['invitations'],
  status: TenderInvitationStatus,
): number {
  return invitations.filter((inv) => inv.status === status).length;
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

  const invitationCounts = useMemo(() => {
    if (!tender) return null;
    return {
      pending: countByInvitationStatus(tender.invitations, 'pending'),
      accepted: countByInvitationStatus(tender.invitations, 'accepted'),
      declined: countByInvitationStatus(tender.invitations, 'declined'),
      expired: countByInvitationStatus(tender.invitations, 'expired'),
    };
  }, [tender]);

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

      {error && <p className="form-error tender-error">{error}</p>}

      {!tender ? (
        <div className="tender-actions-block">
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
            <div className="tender-actions-block">
              <button
                type="button"
                className="primary"
                disabled={busy || tender.acceptedInvitationCount < 1}
                onClick={() => void handleStart()}
              >
                {busy ? 'Opening…' : 'Open tender for bids'}
              </button>
              {tender.acceptedInvitationCount < 1 ? (
                <p className="muted tender-hint">
                  Wait for at least one contractor to accept an invitation.
                  They respond from the Contractor portal (link in the header).
                </p>
              ) : (
                <p className="muted tender-hint">
                  {tender.acceptedInvitationCount} contractor
                  {tender.acceptedInvitationCount === 1 ? '' : 's'} ready to
                  bid. Opening the tender notifies them and starts the deadline.
                </p>
              )}
            </div>
          )}

          {(tender.status === 'open' || tender.status === 'closed') && (
            <p className="muted tender-phase-hint">
              {tender.status === 'open'
                ? 'Bidding is open. New bids are accepted until the deadline.'
                : 'Bidding closed. Compare bids below and select a winner.'}
            </p>
          )}

          {tender.invitations.length > 0 && invitationCounts && (
            <div className="tender-subsection">
              <h3 className="tender-subsection-title">Invited contractors</h3>
              <p className="muted tender-invite-explainer">
                Not every contractor on the platform — only up to{' '}
                {TENDER_INVITATION_LIMIT} verified matches in{' '}
                {project.regionCode} for{' '}
                {formatProjectType(project.projectType).toLowerCase()} work.
                Pending means the invitation was sent and they have not responded
                yet.
              </p>
              <div className="tender-invite-summary">
                {invitationCounts.pending > 0 && (
                  <span className="tender-invite-summary-item pending">
                    {invitationCounts.pending} awaiting response
                  </span>
                )}
                {invitationCounts.accepted > 0 && (
                  <span className="tender-invite-summary-item accepted">
                    {invitationCounts.accepted} accepted
                  </span>
                )}
                {invitationCounts.declined > 0 && (
                  <span className="tender-invite-summary-item declined">
                    {invitationCounts.declined} declined
                  </span>
                )}
                {invitationCounts.expired > 0 && (
                  <span className="tender-invite-summary-item expired">
                    {invitationCounts.expired} expired
                  </span>
                )}
              </div>
              <ul className="tender-invite-list">
                {tender.invitations.map((inv) => (
                  <li key={inv.id} className="tender-invite-item">
                    <div className="tender-invite-main">
                      <span className="tender-invite-name">
                        {inv.companyName ?? 'Contractor'}
                      </span>
                      {inv.respondedAt && (
                        <span className="muted tender-invite-responded">
                          Responded{' '}
                          {new Date(inv.respondedAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      )}
                    </div>
                    <span className={invitationStatusClass(inv.status)}>
                      {formatInvitationStatus(inv.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tender.bids.length > 0 && (
            <div className="tender-subsection">
              <h3 className="tender-subsection-title">Bids &amp; proposals</h3>
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
            </div>
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
