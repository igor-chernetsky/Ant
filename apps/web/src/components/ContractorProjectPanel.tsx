'use client';

import { useCallback, useEffect, useState } from 'react';
import { BidChat } from '@/components/BidChat';
import { ClientCommercialProposalPanel } from '@/components/ClientCommercialProposalPanel';
import { ContractSigningPanel } from '@/components/ContractSigningPanel';
import { BidProposalForm } from '@/components/BidProposalForm';
import { BidOfferSummary } from '@/components/BidOfferSummary';
import { BidProposalSummary } from '@/components/BidProposalSummary';
import { StructuredClarificationForm } from '@/components/StructuredClarificationForm';
import { ContractorClarificationAttachments } from '@/components/ContractorClarificationAttachments';
import { useTranslation } from '@/components/LocaleProvider';
import { useSession } from '@/components/SessionProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
  fetchBidCounterOffers,
  fetchContractorProjectParticipation,
  startContractorClarification,
  submitContractorBid,
  withdrawContractorBid,
  type BidOffer,
  type ContractorProjectParticipation,
} from '@/lib/tendering';
import type { ProjectBriefV1 } from '@/lib/projects';

interface ContractorProjectPanelProps {
  projectId: string;
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

function latestClientCounterOffer(offers: BidOffer[]): BidOffer | null {
  for (let index = offers.length - 1; index >= 0; index -= 1) {
    if (offers[index]?.authorRole === 'client') {
      return offers[index] ?? null;
    }
  }
  return null;
}

export function ContractorProjectPanel({
  projectId,
  projectTitle,
  projectDistrict,
  projectDescription,
  projectBrief = null,
  clarificationSummary = null,
}: ContractorProjectPanelProps) {
  const { t } = useTranslation();
  const {
    formatParticipationLabel,
    formatTenderStatus,
    formatVerificationStatus,
  } = useAppFormatters();
  const { me } = useSession();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [participation, setParticipation] =
    useState<ContractorProjectParticipation | null>(null);
  const [counterOffers, setCounterOffers] = useState<BidOffer[]>([]);
  const [appliedCounterOfferId, setAppliedCounterOfferId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatParticipationStatus = (
    data: ContractorProjectParticipation,
  ): string => {
    const bid = data.myBid;
    if (!bid) return t('participation.notStarted');
    return formatParticipationLabel({
      projectStatus: data.projectStatus,
      bidStatus: bid.status,
      contenderNumber: bid.contenderNumber,
    });
  };

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
        err instanceof Error
          ? err.message
          : t('contractor.loadParticipationFailed'),
      );
      setParticipation(null);
      setCounterOffers([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

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
      setError(err instanceof Error ? err.message : t('contractor.applyFailed'));
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
      setAppliedCounterOfferId(null);
      await loadParticipation();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('contractor.submitProposalFailed'),
      );
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
      setError(err instanceof Error ? err.message : t('contractor.withdrawFailed'));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleWithdrawFromAward = async () => {
    if (!participation?.tenderId) return;
    const confirmed = await confirm({
      title: t('confirm.withdrawAwardTitle'),
      message: t('confirm.withdrawAwardMessage'),
      confirmLabel: t('confirm.withdrawAwardLabel'),
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await withdrawContractorBid(participation.tenderId);
      await loadParticipation();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('contractor.withdrawFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="card contractor-project-card">
        <p className="muted">{t('contractor.loadingParticipation')}</p>
      </section>
    );
  }

  if (!participation) {
    return null;
  }

  if (participation.accessDenied) {
    return (
      <section className="card contractor-project-card">
        <h2 className="section-title">{t('contractor.tenderClosed')}</h2>
        <p className="muted">{t('contractor.tenderClosedHint')}</p>
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
    (participation.projectClarificationSummary?.trim() ||
      clarificationSummary?.trim()) &&
      hasActiveContractorParticipation(participation),
  );
  const resolvedClarificationSummary =
    participation.projectClarificationSummary?.trim() ||
    clarificationSummary ||
    null;
  const canLeaveDiscussion =
    participation.canWithdraw &&
    myBid &&
    (inClarification || enrolled) &&
    !submitted &&
    !selected;
  const showOpenChat =
    !structuredQa && (inClarification || enrolled || submitted);
  const showPostAwardChat = selected && structuredQa;
  const latestClientOffer = latestClientCounterOffer(counterOffers);
  const appliedCounterOffer =
    appliedCounterOfferId != null
      ? (counterOffers.find((offer) => offer.id === appliedCounterOfferId) ??
        null)
      : null;

  return (
    <section className="card contractor-project-card">
      <h2 className="section-title">{t('contractor.participationTitle')}</h2>
      <p className="muted doc-hint">
        {structuredQa
          ? participation.tenderCollectingClarifications
            ? t('contractor.participationHintStructuredCollecting')
            : t('contractor.participationHintStructuredOpen')
          : t('contractor.participationHintDiscussion')}
      </p>

      <dl className="meta-grid contractor-participation-meta">
        <div>
          <dt>{t('contractor.yourStatus')}</dt>
          <dd>{formatParticipationStatus(participation)}</dd>
        </div>
        <div>
          <dt>{t('contractor.tender')}</dt>
          <dd>
            {participation.tenderStatus
              ? formatTenderStatus(participation.tenderStatus)
              : t('contractor.notPublishedYet')}
          </dd>
        </div>
        {myBid?.contenderNumber != null && (
          <div>
            <dt>{t('contractor.contenderNo')}</dt>
            <dd>#{myBid.contenderNumber}</dd>
          </div>
        )}
        {participation.closesAt && (
          <div>
            <dt>{t('contractor.applicationsClose')}</dt>
            <dd>{new Date(participation.closesAt).toLocaleString()}</dd>
          </div>
        )}
        <div>
          <dt>{t('contractor.verification')}</dt>
          <dd>
            {formatVerificationStatus(participation.verificationStatus)}
          </dd>
        </div>
      </dl>

      {participation.applicationsDeadlinePassed && (
        <p className="tender-deadline-passed-notice">
          {t('contractor.deadlinePassedNotice')}
        </p>
      )}

      {showClarificationSummary && resolvedClarificationSummary && (
        <div className="client-clarification-summary contractor-clarification-summary">
          <h3 className="tender-subsection-title">
            {t('contractor.clarificationSummary')}
          </h3>
          <p>{resolvedClarificationSummary}</p>
        </div>
      )}

      {hasActiveContractorParticipation(participation) && (
        <ContractorClarificationAttachments projectId={projectId} />
      )}

      {waitingForPublish && (
        <p className="muted tender-phase-hint">
          {t('contractor.notPublishedForBids')}
        </p>
      )}

      {participation.canStartClarification && (
        <div className="participation-actions">
          <p className="muted participation-actions-hint">
            {structuredQa
              ? t('contractor.startClarificationHintStructured')
              : t('contractor.startClarificationHintDiscussion')}
          </p>
          <div className="participation-toolbar">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void handleApply()}
            >
              {busy ? t('common.starting') : t('contractor.startClarification')}
            </button>
          </div>
        </div>
      )}

      {participation.canApply && (
        <div className="participation-actions">
          <p className="muted participation-actions-hint">
            {structuredQa
              ? t('contractor.applyHintStructured')
              : t('contractor.applyHintDiscussion')}
          </p>
          <div className="participation-toolbar">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void handleApply()}
            >
              {busy ? t('common.applying') : t('common.apply')}
            </button>
          </div>
        </div>
      )}

      {myBid &&
        me?.id &&
        (inClarification || enrolled || submitted || selected) && (
        <div className="tender-subsection">
          {structuredQa &&
          inClarification &&
          participation.tenderCollectingClarifications ? (
            <>
              <h3 className="tender-subsection-title">
                {t('contractor.yourQuestionList')}
              </h3>
              <StructuredClarificationForm
                bidId={myBid.id}
                disabled={busy}
                onSubmitted={() => void loadParticipation()}
              />
              {participation.tenderCollectingClarifications && (
                <p className="muted structured-clarification-waiting">
                  {t('contractor.waitingForClientOpen')}
                </p>
              )}
              {participation.hasSubmittedClarificationQuestions &&
                !participation.tenderCollectingClarifications &&
                participation.tenderStatus === 'open' &&
                enrolled && (
                  <p className="muted structured-clarification-waiting">
                    {t('contractor.enrolledContenderHint', {
                      n: myBid.contenderNumber ?? 0,
                    })}
                  </p>
                )}
            </>
          ) : showOpenChat || showPostAwardChat ? (
            <>
              <h3 className="tender-subsection-title">
                {t('contractor.discussionWithClient')}
              </h3>
              <BidChat
                bidId={myBid.id}
                currentUserId={me.id}
                title={t('contractor.clarificationsTitle')}
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
              {t('contractor.leaveDiscussion')}
            </button>
          </div>
        </div>
      )}

      {submitted && myBid && (
        <div className="tender-subsection">
          <h3 className="tender-subsection-title">{t('contractor.yourProposal')}</h3>
          <BidProposalSummary bid={myBid} compact />
        </div>
      )}

      {counterOffers.length > 0 && (
        <div className="tender-subsection">
          <h3 className="tender-subsection-title">
            {t('contractor.clientCounterOffers')}
          </h3>
          <ul className="bid-offer-list">
            {counterOffers.map((offer) => (
              <li key={offer.id} className="bid-offer-item">
                <BidOfferSummary offer={offer} />
              </li>
            ))}
          </ul>
          {latestClientOffer && participation.canSubmitProposal && (
            <div className="counter-offer-accept">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() =>
                  setAppliedCounterOfferId(latestClientOffer.id)
                }
              >
                {t('contractor.acceptCounterOffer')}
              </button>
              <p className="muted counter-offer-accept-hint">
                {t('contractor.acceptCounterOfferHint')}
              </p>
              {appliedCounterOffer?.id === latestClientOffer.id && (
                <p className="counter-offer-accept-applied">
                  {t('contractor.counterOfferApplied')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {selected && myBid?.id && (
        <div className="tender-subsection">
          <ContractSigningPanel
            projectId={projectId}
            bidId={myBid.id}
            asContractor
            bidAmount={myBid.amount}
            currency="THB"
            onSigned={() => void loadParticipation()}
            onAwardReleased={() => void loadParticipation()}
          />
          {participation.canWithdrawFromAward && (
            <div className="participation-actions">
              <p className="muted participation-actions-hint">
                {t('contractor.withdrawFromAwardHint')}
              </p>
              <div className="participation-toolbar">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => void handleWithdrawFromAward()}
                >
                  {t('contractor.withdrawFromAward')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {participation.canEditCommercialProposal && myBid && (
        <div className="tender-subsection">
          <ClientCommercialProposalPanel
            projectId={projectId}
            bid={myBid}
            audience="contractor"
            projectTitle={projectTitle}
            projectDistrict={projectDistrict}
            projectContractTerms={participation.projectContractTerms}
            readOnly={participation.contractFullySigned}
            onBidUpdated={() => void loadParticipation()}
          />
        </div>
      )}

      {participation.canSubmitProposal && participation.tenderId && (
        <div className="tender-subsection tender-subsection--proposal">
          <h3 className="tender-subsection-title">
            {submitted
              ? t('contractor.updateProposal')
              : t('contractor.submitCommercialProposal')}
          </h3>
          {(enrolled || submitted) && (
            <BidProposalForm
              key={appliedCounterOfferId ?? `bid-${myBid?.id ?? 'new'}`}
              existingBid={submitted ? myBid : null}
              prefillOffer={appliedCounterOffer}
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
      {confirmDialog}
    </section>
  );
}
