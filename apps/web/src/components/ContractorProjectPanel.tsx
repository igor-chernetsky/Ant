'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BidProposalForm } from '@/components/BidProposalForm';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import {
  fetchContractorProjectParticipation,
  formatContractorParticipationLabel,
  formatInvitationStatus,
  formatTenderStatus,
  respondContractorInvitation,
  submitContractorBid,
  withdrawContractorBid,
  type ContractorProjectParticipation,
} from '@/lib/tendering';
import { formatVerificationStatus } from '@/lib/verification';

interface ContractorProjectPanelProps {
  projectId: string;
  ballparkMid?: number | null;
}

export function ContractorProjectPanel({
  projectId,
  ballparkMid = null,
}: ContractorProjectPanelProps) {
  const [participation, setParticipation] =
    useState<ContractorProjectParticipation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadParticipation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContractorProjectParticipation(projectId);
      setParticipation(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load participation',
      );
      setParticipation(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadParticipation();
  }, [loadParticipation]);

  const handleRespond = async (accept: boolean) => {
    if (!participation) return;
    setBusy(true);
    setError(null);
    try {
      await respondContractorInvitation(participation.tenderId, accept);
      await loadParticipation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to respond');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitBid = async (
    input: Parameters<typeof submitContractorBid>[1],
  ) => {
    if (!participation) return;
    setBusy(true);
    setError(null);
    try {
      await submitContractorBid(participation.tenderId, input);
      await loadParticipation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!participation) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawContractorBid(participation.tenderId);
      await loadParticipation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw bid');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="card contractor-project-card">
        <p className="muted">Loading your participation…</p>
      </section>
    );
  }

  if (!participation) {
    return null;
  }

  const summaryLabel = formatContractorParticipationLabel({
    invitationStatus: participation.invitation.status,
    tenderStatus: participation.tenderStatus,
    bidStatus: participation.myBid?.status ?? null,
  });

  const verified = participation.verificationStatus === 'verified';

  return (
    <section className="card contractor-project-card">
      <h2 className="section-title">Your participation</h2>
      <p className="muted doc-hint">
        You were invited to bid on this project. Manage your invitation and
        proposal here, or open the{' '}
        <Link href="/contractor" className="text-link">
          Contractor portal
        </Link>{' '}
        for all tenders.
      </p>

      <dl className="meta-grid contractor-participation-meta">
        <div>
          <dt>Your status</dt>
          <dd>{summaryLabel}</dd>
        </div>
        <div>
          <dt>Invitation</dt>
          <dd>{formatInvitationStatus(participation.invitation.status)}</dd>
        </div>
        <div>
          <dt>Tender</dt>
          <dd>{formatTenderStatus(participation.tenderStatus)}</dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>
            {formatVerificationStatus(participation.verificationStatus)}
          </dd>
        </div>
        {participation.closesAt && (
          <div>
            <dt>Bidding closes</dt>
            <dd>{new Date(participation.closesAt).toLocaleString()}</dd>
          </div>
        )}
      </dl>

      {!verified && (
        <div className="contractor-participation-callout">
          <p className="contractor-participation-callout-title">
            Verification required
          </p>
          <p className="contractor-participation-callout-text">
            Complete contractor verification before accepting invitations or
            submitting bids.{' '}
            <Link href="/contractor" className="text-link">
              Open Contractor portal
            </Link>
          </p>
        </div>
      )}

      {participation.canRespondToInvitation && (
        <div className="tender-actions-block">
          <p className="muted tender-hint">
            Accept the invitation to be ready when the client opens bidding.
          </p>
          <div className="row">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void handleRespond(true)}
            >
              Accept invitation
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void handleRespond(false)}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {participation.invitation.status === 'pending' &&
        verified &&
        !participation.canRespondToInvitation && (
          <p className="muted tender-phase-hint">
            This invitation is no longer accepting responses.
          </p>
        )}

      {participation.invitation.status === 'accepted' &&
        participation.tenderStatus === 'collecting_participants' && (
          <p className="muted tender-phase-hint">
            You accepted the invitation. The client will open bidding when ready.
          </p>
        )}

      {participation.myBid && (
        <div className="tender-subsection">
          <h3 className="tender-subsection-title">Your bid</h3>
          <p className="contractor-bid-status-line">
            Status:{' '}
            <span className="status-pill">
              {participation.myBid.status.replaceAll('_', ' ')}
            </span>
          </p>
          <BidProposalSummary
            bid={participation.myBid}
            ballparkMid={ballparkMid}
            compact
          />
        </div>
      )}

      {participation.canSubmitBid && (
        <div className="tender-subsection">
          <h3 className="tender-subsection-title">
            {participation.myBid ? 'Update your bid' : 'Submit your bid'}
          </h3>
          <BidProposalForm
            existingBid={participation.myBid}
            busy={busy}
            onSubmit={handleSubmitBid}
            onWithdraw={
              participation.myBid?.status === 'submitted'
                ? handleWithdraw
                : undefined
            }
          />
        </div>
      )}

      {participation.invitation.status === 'accepted' &&
        participation.tenderStatus === 'open' &&
        !participation.canSubmitBid &&
        !participation.myBid &&
        verified && (
          <p className="muted tender-phase-hint">
            Bidding is open, but you cannot submit a bid right now.
          </p>
        )}

      {error && <p className="form-error contractor-participation-error">{error}</p>}
    </section>
  );
}
