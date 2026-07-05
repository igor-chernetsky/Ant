'use client';

import { useCallback, useEffect, useState } from 'react';
import { BidChat } from '@/components/BidChat';
import { CommercialProposalDownload } from '@/components/CommercialProposalDownload';
import { BidProposalForm } from '@/components/BidProposalForm';
import { BidOfferSummary } from '@/components/BidOfferSummary';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import { StructuredClarificationForm } from '@/components/StructuredClarificationForm';
import { ContractorClarificationAttachments } from '@/components/ContractorClarificationAttachments';
import { useSession } from '@/components/SessionProvider';
import {
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
import type { ProjectBriefV1 } from '@/lib/projects';

interface ContractorProjectPanelProps {
  projectId: string;
  ballparkMid?: number | null;
  projectTitle?: string;
  projectDistrict?: string | null;
  projectDescription?: string | null;
  projectBrief?: ProjectBriefV1 | null;
  clarificationSummary?: string | null;
}

function hasActiveContractorParticipation(
  participation: ContractorProjectParticipation,
): boolean {
  const bid = participation.myBid;
  if (!bid || bid.status === 'withdrawn') {
    return false;
  }

  return (
    bid.status === 'clarifying' ||
    bid.status === 'enrolled' ||
    bid.status === 'submitted' ||
    bid.status === 'selected' ||
    bid.status === 'rejected'
  );
}

function formatParticipationStatus(
  participation: ContractorProjectParticipation,
): string {
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
  projectTitle,
  projectDistrict,
  projectDescription,
  projectBrief = null,
  clarificationSummary = null,
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

  const handleApply = async () => {
    if (!participation?.tenderId) return;
    setBusy(true);
    setError(null);
    try {
      await startContractorClarification(participation.tenderId);
      await loadParticipation();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to apply for participation',
      );
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
  const structuredQa = participation.clarificationMode === 'structured_qa';
  const enrolled = myBid?.status === 'enrolled';
  const submitted = myBid?.status === 'submitted';
  const selected = myBid?.status === 'selected';
  const showClarificationSummary = Boolean(
    clarificationSummary?.trim() &&
      hasActiveContractorParticipation(participation),
  );
  const canLeaveDiscussion =
    participation.canWithdraw &&
    myBid &&
    (inClarification || enrolled) &&
    !submitted &&
    !selected;

  return (
    <section className="card contractor-project-card">
      <h2 className="section-title">Your participation</h2>
      <p className="muted doc-hint">
        {structuredQa
          ? participation.tenderCollectingClarifications
            ? 'Submit your clarification questions once. The client will open the tender for proposals when ready.'
            : 'The tender is open. Apply to participate and submit your commercial proposal.'
          : 'Ask clarifying questions in the discussion. You are enrolled automatically and can submit your commercial proposal when ready.'}
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
        {participation.closesAt && (
          <div>
            <dt>Applications close</dt>
            <dd>{new Date(participation.closesAt).toLocaleString()}</dd>
          </div>
        )}
        <div>
          <dt>Verification</dt>
          <dd>
            {formatVerificationStatus(participation.verificationStatus)}
          </dd>
        </div>
      </dl>

      {participation.applicationsDeadlinePassed && (
        <p className="tender-deadline-passed-notice">
          The application deadline has passed. You can continue with your current
          participation, but new applications are no longer accepted.
        </p>
      )}

      {showClarificationSummary && (
        <div className="client-clarification-summary contractor-clarification-summary">
          <h3 className="tender-subsection-title">Clarification summary</h3>
          <p>{clarificationSummary}</p>
        </div>
      )}

      {hasActiveContractorParticipation(participation) && (
        <ContractorClarificationAttachments projectId={projectId} />
      )}

      {waitingForPublish && (
        <p className="muted tender-phase-hint">
          The client has not published this project for bids yet.
        </p>
      )}

      {participation.canStartClarification && (
        <div className="participation-actions">
          <p className="muted participation-actions-hint">
            {structuredQa
              ? 'Start clarification to compose your one-time question list for the client.'
              : 'Start the discussion to ask the client about scope, access, or timeline.'}
          </p>
          <div className="participation-toolbar">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void handleApply()}
            >
              {busy ? 'Starting…' : 'Start clarification'}
            </button>
          </div>
        </div>
      )}

      {participation.canApply && (
        <div className="participation-actions">
          <p className="muted participation-actions-hint">
            {structuredQa
              ? 'Apply to participate in the tender and submit your commercial proposal.'
              : 'Apply to join the discussion and submit your commercial proposal when ready.'}
          </p>
          <div className="participation-toolbar">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void handleApply()}
            >
              {busy ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </div>
      )}

      {myBid && (inClarification || enrolled || submitted) && me?.id && (
        <div className="tender-subsection">
          {structuredQa && inClarification && participation.tenderCollectingClarifications ? (
            <>
              <h3 className="tender-subsection-title">Your question list</h3>
              <StructuredClarificationForm
                bidId={myBid.id}
                disabled={busy}
                onSubmitted={() => void loadParticipation()}
              />
              {participation.tenderCollectingClarifications && (
                <p className="muted structured-clarification-waiting">
                  Waiting for the client to open the tender for commercial
                  proposals.
                </p>
              )}
              {participation.hasSubmittedClarificationQuestions &&
                !participation.tenderCollectingClarifications &&
                participation.tenderStatus === 'open' &&
                enrolled && (
                  <p className="muted structured-clarification-waiting">
                    You are enrolled as contender #{myBid.contenderNumber} —
                    submit your commercial proposal below.
                  </p>
                )}
            </>
          ) : !structuredQa ? (
            <>
              <h3 className="tender-subsection-title">Discussion with client</h3>
              <BidChat
                bidId={myBid.id}
                currentUserId={me.id}
                title="Clarifications & questions"
              />
            </>
          ) : null}
        </div>
      )}

      {canLeaveDiscussion && (
        <div className="participation-actions">
          <div className="participation-toolbar">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void handleWithdraw()}
            >
              Leave discussion
            </button>
          </div>
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
                <BidOfferSummary offer={offer} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && myBid?.id && (
        <div className="tender-subsection">
          <h3 className="tender-subsection-title">Contract draft</h3>
          <p className="muted participation-actions-hint">
            You were selected for this project. Download the draft contract
            document.
          </p>
          <CommercialProposalDownload bidId={myBid.id} />
        </div>
      )}

      {participation.canSubmitProposal && participation.tenderId && (
        <div className="tender-subsection tender-subsection--proposal">
          <h3 className="tender-subsection-title">
            {submitted ? 'Update your proposal' : 'Submit commercial proposal'}
          </h3>
          {(enrolled || submitted) && (
            <BidProposalForm
              existingBid={submitted ? myBid : null}
              busy={busy}
              projectTitle={projectTitle}
              projectDistrict={projectDistrict}
              projectDescription={projectDescription}
              projectBrief={projectBrief}
              defaultCostBreakdown={participation.defaultCostBreakdown ?? []}
              projectScopeSummary={participation.projectScopeSummary}
              projectContractTerms={participation.projectContractTerms}
              onSubmit={handleSubmitBid}
              onWithdraw={participation.canWithdraw ? handleWithdraw : undefined}
            />
          )}
        </div>
      )}

      {error && <p className="form-error contractor-participation-error">{error}</p>}
    </section>
  );
}
