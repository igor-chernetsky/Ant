'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatThb } from '@/lib/estimate';
import type { Project } from '@/lib/projects';
import {
  fetchProjectTender,
  revertProjectTender,
  updateTenderDeadline,
  type Tender,
} from '@/lib/tendering';
import { ClientClarificationQuestionsPanel } from '@/components/ClientClarificationQuestionsPanel';
import { useTranslation } from '@/components/LocaleProvider';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useAppFormatters } from '@/hooks/useAppFormatters';
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

export function TenderSummaryCard({
  projectId,
  project,
  onUpdated,
}: TenderSummaryCardProps) {
  const { t } = useTranslation();
  const { formatTenderStatus } = useAppFormatters();
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
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const applicationLabel = (count: number) =>
    count === 1
      ? t('tenderCard.application_one')
      : t('tenderCard.application_other');

  const proposalLabel = (count: number) =>
    count === 1
      ? t('tenderCard.proposal_one')
      : t('tenderCard.proposal_other');

  const formatApplicationsPhrase = (count: number) =>
    `${count} ${applicationLabel(count)}`;

  const formatProposalsPhrase = (count: number) =>
    `${count} ${proposalLabel(count)}`;

  const formatDeadlineLabel = (value: Tender): string => {
    if (value.noApplicationsDeadline || !value.closesAt) {
      return t('tenderCard.noTimeLimit');
    }
    return new Date(value.closesAt).toLocaleString();
  };

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
      setError(err instanceof Error ? err.message : t('tenderCard.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

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
        err instanceof Error
          ? err.message
          : t('tenderCard.updateDeadlineFailed'),
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
    const confirmed = await confirm({
      title: t('confirm.returnToPreparationTitle'),
      message: t('confirm.returnToPreparationMessage'),
      confirmLabel: t('confirm.returnToPreparationLabel'),
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await revertProjectTender(projectId);
      setTender(null);
      await refreshProject();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('tenderCard.revertFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="card tender-card">
        <p className="muted">{t('tenderCard.loading')}</p>
      </section>
    );
  }

  return (
    <section className="card tender-card tender-summary-card">
      <div className="tender-card-header">
        <h2 className="section-title">{t('tenderCard.title')}</h2>
        {tender && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void loadTender()}
          >
            {t('tenderCard.refresh')}
          </button>
        )}
      </div>

      {error && <p className="form-error tender-error">{error}</p>}

      {!tender ? (
        <>
          <p className="muted doc-hint">
            {structuredQa
              ? t('tenderCard.publishStructuredHint')
              : t('tenderCard.publishOpenHint')}
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
              {structuredQa
                ? t('tenderCard.publishForClarification')
                : t('tenderCard.publishForBids')}
            </button>
            {!canPublish && (
              <p className="muted tender-hint">
                {t('tenderCard.completeIntakeHint')}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <dl className="meta-grid tender-meta tender-summary-meta">
            <div>
              <dt>{t('common.status')}</dt>
              <dd>
                {collectingQuestions
                  ? t('tenderCard.collectingQuestions')
                  : formatTenderStatus(tender.status)}
              </dd>
            </div>
            <div>
              <dt>{t('tenderCard.applications')}</dt>
              <dd>{tender.applicationCount ?? tender.bids.length}</dd>
            </div>
            {(tender.submittedBidCount ?? 0) > 0 && (
              <div>
                <dt>{t('tenderCard.proposals')}</dt>
                <dd>{tender.submittedBidCount}</dd>
              </div>
            )}
            <div>
              <dt>{t('tenderCard.applicationsClose')}</dt>
              <dd>{formatDeadlineLabel(tender)}</dd>
            </div>
          </dl>

          {deadlineExpired && tender.status !== 'awarded' && (
            <div className="tender-deadline-expired">
              <p className="tender-deadline-expired-lead">
                {t('tenderCard.deadlineExpiredLead', {
                  applications: formatApplicationsPhrase(
                    tender.applicationCount ?? tender.bids.length,
                  ),
                  proposals:
                    (tender.submittedBidCount ?? 0) > 0
                      ? t('tenderCard.andProposals', {
                          count: tender.submittedBidCount!,
                          proposals: proposalLabel(tender.submittedBidCount!),
                        })
                      : '',
                })}
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
                  {busy ? t('common.saving') : t('tenderCard.extendDeadline')}
                </button>
              </div>
            </div>
          )}

          {tender.bids.length > 0 && (
            <div className="tender-summary-actions">
              <p className="muted tender-summary-lead">
                {tender.status === 'awarded' && tender.awardedBidId ? (
                  t('tenderCard.awardedLead')
                ) : tender.submittedBidCount > 0 ? (
                  <>
                    {t('tenderCard.reviewCount', {
                      applications: formatApplicationsPhrase(
                        tender.applicationCount ?? tender.bids.length,
                      ),
                      proposals: formatProposalsPhrase(tender.submittedBidCount),
                    })}
                    {(() => {
                      const amounts = tender.bids
                        .filter((b) => b.status === 'submitted' && b.amount != null)
                        .map((b) => Number(b.amount));
                      if (amounts.length === 0) return null;
                      return (
                        <>
                          {' '}
                          {t('tenderCard.lowestOffer', {
                            amount: formatThb(Math.min(...amounts)),
                          })}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  t('tenderCard.waitingProposals', {
                    applications: formatApplicationsPhrase(
                      tender.applicationCount ?? tender.bids.length,
                    ),
                  })
                )}
              </p>
              <Link href={bidsHref} className="primary tender-summary-cta">
                {tender.status === 'awarded'
                  ? t('tenderCard.reviewBids')
                  : t('tenderCard.viewCompareBids')}
              </Link>
            </div>
          )}

          {collectingQuestions && (
            <div className="tender-actions-block tender-publish-block">
              <p className="muted tender-phase-hint">
                {t('tenderCard.clarificationPhaseHint')}
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
                {t('tenderCard.openTenderForBids')}
              </button>
            </div>
          )}

          {tender.bids.length === 0 && !collectingQuestions && (
            <>
              <p className="muted tender-phase-hint">
                {t('tenderCard.publishedWaiting')}
              </p>
              {canRevert && (
                <div className="tender-actions-block">
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void handleRevert()}
                  >
                    {busy
                      ? t('tenderCard.returning')
                      : t('tenderCard.returnToPreparation')}
                  </button>
                  <p className="muted tender-hint">
                    {t('tenderCard.unpublishHint')}
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
      {confirmDialog}
    </section>
  );
}
