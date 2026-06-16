'use client';

import { useCallback, useEffect, useState } from 'react';
import { BidChat } from '@/components/BidChat';
import { BidProposalForm } from '@/components/BidProposalForm';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import { useSession } from '@/components/SessionProvider';
import {
  fetchContractorProjectParticipation,
  formatTenderStatus,
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
  const { me } = useSession();
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

  const handleSubmitBid = async (
    input: Parameters<typeof submitContractorBid>[1],
  ) => {
    if (!participation?.tenderId) return;
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
    if (!participation?.tenderId) return;
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

  const bidStatusLabel = participation.myBid
    ? participation.myBid.status.replaceAll('_', ' ')
    : 'No application yet';

  const waitingForPublish =
    !participation.tenderId &&
    ['estimated', 'tender_ready'].includes(participation.projectStatus);

  return (
    <section className="card contractor-project-card">
      <h2 className="section-title">Your application</h2>
      <p className="muted doc-hint">
        Submit your bid when bidding opens and discuss details with the client
        in the internal chat.
      </p>

      <dl className="meta-grid contractor-participation-meta">
        <div>
          <dt>Your status</dt>
          <dd>{bidStatusLabel}</dd>
        </div>
        <div>
          <dt>Tender</dt>
          <dd>
            {participation.tenderStatus
              ? formatTenderStatus(participation.tenderStatus)
              : 'Not published yet'}
          </dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>
            {formatVerificationStatus(participation.verificationStatus)}
          </dd>
        </div>
        {participation.closesAt ? (
          <div>
            <dt>Bidding closes</dt>
            <dd>{new Date(participation.closesAt).toLocaleString()}</dd>
          </div>
        ) : participation.canSubmitBid ? (
          <div>
            <dt>Deadline</dt>
            <dd>Starts when the first contractor applies</dd>
          </div>
        ) : null}
      </dl>

      {waitingForPublish && (
        <p className="muted tender-phase-hint">
          The client has not published this project for bids yet. Check back
          after they complete the estimate and click &quot;Publish for bids&quot;.
        </p>
      )}

      {!waitingForPublish && !participation.canSubmitBid && (
        <p className="muted tender-phase-hint">
          Bidding is not open right now.
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
          {me?.id && (
            <BidChat
              bidId={participation.myBid.id}
              currentUserId={me.id}
            />
          )}
        </div>
      )}

      {participation.canSubmitBid && participation.tenderId && (
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

      {error && <p className="form-error contractor-participation-error">{error}</p>}
    </section>
  );
}
