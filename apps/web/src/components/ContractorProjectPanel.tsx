'use client';

import { useCallback, useEffect, useState } from 'react';
import { BidChat } from '@/components/BidChat';
import { BidProposalForm } from '@/components/BidProposalForm';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import { useSession } from '@/components/SessionProvider';
import {
  enrollContractorInTender,
  fetchBidCounterOffers,
  fetchContractorProjectParticipation,
  formatTenderStatus,
  startContractorClarification,
  submitContractorBid,
  withdrawContractorBid,
  type BidOffer,
  type ContractorProjectParticipation,
} from '@/lib/tendering';
import { formatVerificationStatus } from '@/lib/verification';

interface ContractorProjectPanelProps {
  projectId: string;
  ballparkMid?: number | null;
}

function formatParticipationStatus(participation: ContractorProjectParticipation): string {
  const bid = participation.myBid;
  if (!bid) return 'Not started';
  if (bid.status === 'clarifying') return 'Clarifying scope';
  if (bid.status === 'enrolled') {
    return bid.contenderNumber != null
      ? `Contender #${bid.contenderNumber}`
      : 'Enrolled';
  }
  return bid.status.replaceAll('_', ' ');
}

export function ContractorProjectPanel({
  projectId,
  ballparkMid = null,
}: ContractorProjectPanelProps) {
  const { me } = useSession();
  const [participation, setParticipation] =
    useState<ContractorProjectParticipation | null>(null);
  const [counterOffers, setCounterOffers] = useState<BidOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadParticipation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContractorProjectParticipation(projectId);
      setParticipation(data);
      if (data?.myBid?.id && data.myBid.status === 'submitted') {
        const offers = await fetchBidCounterOffers(projectId, data.myBid.id);
        setCounterOffers(offers);
      } else {
        setCounterOffers([]);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load participation',
      );
      setParticipation(null);
      setCounterOffers([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadParticipation();
  }, [loadParticipation]);

  const handleStartClarification = async () => {
    if (!participation?.tenderId) return;
    setBusy(true);
    setError(null);
    try {
      await startContractorClarification(participation.tenderId);
      await loadParticipation();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to start clarification',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEnroll = async () => {
    if (!participation?.tenderId) return;
    setBusy(true);
    setError(null);
    try {
      await enrollContractorInTender(participation.tenderId);
      await loadParticipation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to enroll');
    } finally {
      setBusy(false);
    }
  };

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
      setError(err instanceof Error ? err.message : 'Failed to submit proposal');
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
      setError(err instanceof Error ? err.message : 'Failed to withdraw');
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

  if (participation.accessDenied) {
    return (
      <section className="card contractor-project-card">
        <h2 className="section-title">Tender closed</h2>
        <p className="muted">
          Another contractor was selected. This project is no longer available
          in your workspace.
        </p>
      </section>
    );
  }

  const waitingForPublish =
    !participation.tenderId && participation.projectStatus === 'estimated';

  const myBid = participation.myBid;
  const inClarification = myBid?.status === 'clarifying';
  const enrolled = myBid?.status === 'enrolled';
  const submitted = myBid?.status === 'submitted';

  return (
    <section className="card contractor-project-card">
      <h2 className="section-title">Your participation</h2>
      <p className="muted doc-hint">
        Ask clarifying questions first, enroll as a contender, then submit your
        commercial proposal. The client may send counter-offers until a winner is
        chosen.
      </p>

      <dl className="meta-grid contractor-participation-meta">
        <div>
          <dt>Your status</dt>
          <dd>{formatParticipationStatus(participation)}</dd>
        </div>
        <div>
          <dt>Tender</dt>
          <dd>
            {participation.tenderStatus
              ? formatTenderStatus(participation.tenderStatus)
              : 'Not published yet'}
          </dd>
        </div>
        {myBid?.contenderNumber != null && (
          <div>
            <dt>Contender no.</dt>
            <dd>#{myBid.contenderNumber}</dd>
          </div>
        )}
        <div>
          <dt>Verification</dt>
          <dd>
            {formatVerificationStatus(participation.verificationStatus)}
          </dd>
        </div>
      </dl>

      {waitingForPublish && (
        <p className="muted tender-phase-hint">
          The client has not published this project for bids yet.
        </p>
      )}

      {participation.canStartClarification && (
        <div className="tender-actions-block">
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void handleStartClarification()}
          >
            {busy ? 'Starting…' : 'Start clarification'}
          </button>
          <p className="muted tender-hint">
            Ask the client questions about scope, access, or timeline before
            enrolling.
          </p>
        </div>
      )}

      {myBid && (inClarification || enrolled || submitted) && me?.id && (
        <div className="tender-subsection">
          <h3 className="tender-subsection-title">Discussion with client</h3>
          <BidChat
            bidId={myBid.id}
            currentUserId={me.id}
            title="Clarifications & questions"
          />
        </div>
      )}

      {participation.canEnroll && (
        <div className="tender-actions-block">
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void handleEnroll()}
          >
            {busy ? 'Enrolling…' : 'Apply for participation'}
          </button>
          <p className="muted tender-hint">
            Receive your contender number and proceed to submit a commercial
            proposal. You can leave the discussion at any time before enrolling.
          </p>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void handleWithdraw()}
          >
            Leave discussion
          </button>
        </div>
      )}

      {submitted && myBid && (
        <div className="tender-subsection">
          <h3 className="tender-subsection-title">Your proposal</h3>
          <BidProposalSummary bid={myBid} ballparkMid={ballparkMid} compact />
        </div>
      )}

      {counterOffers.length > 0 && (
        <div className="tender-subsection">
          <h3 className="tender-subsection-title">Client counter-offers</h3>
          <ul className="bid-offer-list">
            {counterOffers.map((offer) => (
              <li key={offer.id} className="bid-offer-item">
                <p className="bid-offer-meta muted">
                  {offer.authorRole === 'client' ? 'Client' : 'You'} ·{' '}
                  {new Date(offer.createdAt).toLocaleString()}
                </p>
                <p className="bid-offer-amount">
                  {Number(offer.amount).toLocaleString()} THB
                  {offer.durationDays != null && ` · ${offer.durationDays} days`}
                </p>
                {offer.note && <p className="bid-offer-note">{offer.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {participation.canSubmitProposal && participation.tenderId && (
        <div className="tender-subsection">
          <h3 className="tender-subsection-title">
            {submitted ? 'Update your proposal' : 'Submit commercial proposal'}
          </h3>
          {(enrolled || submitted) && (
            <BidProposalForm
              existingBid={submitted ? myBid : null}
              busy={busy}
              onSubmit={handleSubmitBid}
              onWithdraw={participation.canWithdraw ? handleWithdraw : undefined}
            />
          )}
        </div>
      )}

      {participation.canWithdraw && submitted && (
        <div className="tender-actions-block">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void handleWithdraw()}
          >
            Withdraw proposal
          </button>
        </div>
      )}

      {error && <p className="form-error contractor-participation-error">{error}</p>}
    </section>
  );
}
