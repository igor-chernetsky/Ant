'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BidAnalysisPanel } from '@/components/BidAnalysisPanel';
import { BidApplicationCard } from '@/components/BidApplicationCard';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { BidsCompareTable } from '@/components/BidsCompareTable';
import { ClientClarificationQuestionsPanel } from '@/components/ClientClarificationQuestionsPanel';
import { LoginModal } from '@/components/LoginModal';
import { InviteFromDirectoryModal } from '@/components/InviteFromDirectoryModal';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useTranslation } from '@/components/LocaleProvider';
import { useSession } from '@/components/SessionProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { fetchProject, type Project } from '@/lib/projects';
import {
  fetchProjectTender,
  isComparableProposalBid,
  selectProjectBid,
  type Bid,
  type BidAnalysisState,
  type Tender,
} from '@/lib/tendering';
import { tenderHasStaleEmptyResponses } from '@/lib/directory-invite-suggest';
import { ContractorCoverageNotice } from '@/components/ContractorCoverageNotice';

export default function ProjectBidsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const { t } = useTranslation();
  const { formatTenderStatus } = useAppFormatters();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();

  const [project, setProject] = useState<Project | null>(null);
  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [recommendedBidId, setRecommendedBidId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const handleAnalysisStateChange = useCallback(
    (state: BidAnalysisState | null) => {
      setRecommendedBidId(state?.analysis?.recommendedBidId ?? null);
    },
    [],
  );

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!projectId || !sessionReady) return;

      const silent = options?.silent === true;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (!me) {
        setProject(null);
        setTender(null);
        setLoading(false);
        setRefreshing(false);
        router.replace('/');
        return;
      }

      try {
        const projectData = await fetchProject(projectId);
        setProject(projectData);
        const tenderData = await fetchProjectTender(projectId);
        setTender(tenderData);
      } catch (err: unknown) {
        if (silent) {
          setError(
            err instanceof Error ? err.message : t('bidsPage.loadFailed'),
          );
        } else {
          setProject(null);
          setTender(null);
          // Owner-only page — send unauthorized users home instead of an error card.
          router.replace('/');
          return;
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId, sessionReady, me, router, t],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleBidUpdated = (updatedBid: Bid) => {
    setTender((prev) =>
      prev
        ? {
            ...prev,
            bids: prev.bids.map((b) =>
              b.id === updatedBid.id ? updatedBid : b,
            ),
          }
        : null,
    );
  };

  const handleSelectBid = async (bid: Bid) => {
    const confirmed = await confirm({
      title: t('confirm.selectContractorTitle'),
      message: t('confirm.selectContractorMessage', {
        name: bid.companyName ?? t('common.contractor'),
      }),
      confirmLabel: t('confirm.selectContractorLabel'),
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await selectProjectBid(projectId, bid.id);
      router.push(`/projects/${projectId}?contract=edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('bidsPage.selectFailed'));
    } finally {
      setBusy(false);
    }
  };

  const ballparkMid = project?.estimate?.totals.midAmount ?? null;
  const projectHref = `/projects/${projectId}`;
  const tenderAwarded = tender?.status === 'awarded';

  const displayBids = useMemo(() => {
    if (!tender) return [];
    return [...tender.bids].sort((a, b) => {
      if (a.status === 'selected') return -1;
      if (b.status === 'selected') return 1;
      if (a.status === 'submitted' && b.status !== 'submitted') return -1;
      if (b.status === 'submitted' && a.status !== 'submitted') return 1;
      return 0;
    });
  }, [tender]);

  const comparableBids = useMemo(
    () => (tender ? tender.bids.filter(isComparableProposalBid) : []),
    [tender],
  );

  const expandAiRecommendedOnly =
    !tenderAwarded &&
    Boolean(recommendedBidId) &&
    displayBids.length > 1;

  const bidsRevision = useMemo(() => {
    if (!tender) {
      return '';
    }
    const bidSnapshot = [...tender.bids]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((bid) => {
        const contract = bid.terms?.contractTerms;
        return [
          bid.id,
          bid.status,
          bid.amount,
          bid.durationDays ?? '',
          bid.terms?.scopeSummary ?? '',
          bid.terms?.approach ?? '',
          contract?.advancePaymentPercent ?? '',
          contract?.defectNotificationMonths ?? '',
        ].join(':');
      })
      .join('|');
    return `${tender.updatedAt}|${bidSnapshot}`;
  }, [tender]);

  return (
    <PageShell className="page-shell--bids">
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />

      <main className="project-bids-main main-content">
        <div className="project-bids-layout">
          {!sessionReady || loading ? (
            <section className="card">
              <p className="muted">{t('bidsPage.loading')}</p>
            </section>
          ) : null}

          {error && (
            <section className="card error">
              <p>{error}</p>
            </section>
          )}

          {!loading && me && project && (
            <>
              <header className="project-bids-header">
                <p className="project-bids-kicker">
                  <Link href="/" className="project-hero-back-link">
                    {t('bidsPage.projects')}
                  </Link>
                  <span className="project-hero-kicker-sep" aria-hidden>
                    /
                  </span>
                  <Link href={projectHref} className="project-hero-back-link">
                    {project.title}
                  </Link>
                  <span className="project-hero-kicker-sep" aria-hidden>
                    /
                  </span>
                  <span>{t('bidsPage.bids')}</span>
                </p>
                <div className="project-bids-title-row">
                  <h1 className="project-bids-title">
                    {t('bidsPage.compareTitle')}
                  </h1>
                  <div className="project-bids-title-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy || refreshing || loading}
                      onClick={() => void loadData({ silent: true })}
                    >
                      {refreshing
                        ? t('bidsPage.refreshing')
                        : t('bidsPage.refresh')}
                    </button>
                    <Link
                      href={projectHref}
                      className="secondary project-bids-back"
                    >
                      {t('bidsPage.backToProject')}
                    </Link>
                  </div>
                </div>
                {tender && (
                  <dl className="meta-grid tender-meta project-bids-meta">
                    <div>
                      <dt>{t('common.status')}</dt>
                      <dd>{formatTenderStatus(tender.status)}</dd>
                    </div>
                    <div>
                      <dt>{t('tenderCard.applications')}</dt>
                      <dd>{tender.applicationCount ?? tender.bids.length}</dd>
                    </div>
                    {(tender.submittedBidCount > 0 ||
                      comparableBids.length > 0) && (
                      <div>
                        <dt>{t('tenderCard.proposals')}</dt>
                        <dd>
                          {tender.submittedBidCount > 0
                            ? tender.submittedBidCount
                            : comparableBids.length}
                        </dd>
                      </div>
                    )}
                    {tender.closesAt && (
                      <div>
                        <dt>{t('bidsPage.closes')}</dt>
                        <dd>{new Date(tender.closesAt).toLocaleString()}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </header>

              {!tender ? (
                <section className="card">
                  <p className="muted">{t('bidsPage.noTender')}</p>
                  <Link href={projectHref} className="primary">
                    {t('bidsPage.goToProject')}
                  </Link>
                </section>
              ) : (
                <>
                  {comparableBids.length >= 2 && (
                    <>
                      <BidAnalysisPanel
                        projectId={projectId}
                        submittedBidCount={
                          tender.submittedBidCount > 0
                            ? tender.submittedBidCount
                            : comparableBids.length
                        }
                        bidsRevision={bidsRevision}
                        onAnalysisStateChange={handleAnalysisStateChange}
                      />
                      <BidsCompareTable
                        bids={comparableBids}
                        ballparkMid={ballparkMid}
                        defaultCostBreakdown={tender.defaultCostBreakdown}
                      />
                    </>
                  )}

                  <div className="project-bids-duo">
                    <section className="card tender-card">
                      <h2 className="section-title">
                        {t('bidsPage.applicationsTitle')}
                      </h2>

                      {displayBids.length > 0 ? (
                        <ul className="bid-proposal-list">
                          {displayBids.map((bid) => (
                            <BidApplicationCard
                              key={bid.id}
                              bid={bid}
                              ballparkMid={ballparkMid}
                              tenderStatus={tender.status}
                              currency={tender.currency}
                              busy={busy}
                              currentUserId={me.id}
                              projectId={projectId}
                              onSelect={handleSelectBid}
                              defaultExpanded={
                                tenderAwarded
                                  ? bid.status === 'selected'
                                  : expandAiRecommendedOnly
                                    ? bid.id === recommendedBidId
                                    : true
                              }
                              clientCounterOffer={{
                                projectId,
                                tenderOpen:
                                  tender.status === 'open' ||
                                  tender.status === 'closed',
                                projectTitle: project?.title,
                                projectDistrict: project?.district,
                                projectDescription:
                                  project?.description ?? undefined,
                                projectScopeSummary: project?.scopeSummary,
                                projectContractTerms:
                                  tender.projectContractTerms,
                                defaultCostBreakdown:
                                  tender.defaultCostBreakdown,
                                onBidUpdated: handleBidUpdated,
                              }}
                              clarificationMode={project?.clarificationMode}
                              onContractSigned={() => void loadData()}
                            />
                          ))}
                        </ul>
                      ) : (
                        <div className="tender-actions-block">
                          <p className="muted">{t('bidsPage.noApplications')}</p>
                          <ContractorCoverageNotice
                            projectId={projectId}
                            enabled
                            tagKey={(project?.tags ?? [])
                              .map((tag) => tag.slug)
                              .join(',')}
                            audience={
                              project?.projectType === 'design'
                                ? 'designer'
                                : 'contractor'
                            }
                            onInviteFromDirectory={() =>
                              setInviteModalOpen(true)
                            }
                          />
                          <p className="muted tender-hint">
                            {tenderHasStaleEmptyResponses(tender)
                              ? t('tenderCard.inviteSuggestStale')
                              : t('tenderCard.inviteFromDirectoryHint')}
                          </p>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setInviteModalOpen(true)}
                          >
                            {t('tenderCard.inviteFromDirectory')}
                          </button>
                        </div>
                      )}
                    </section>

                    {project.clarificationMode === 'structured_qa' && (
                      <section className="card project-bids-clarifications-card">
                        <ClientClarificationQuestionsPanel
                          projectId={projectId}
                          tenderStatus={tender.status}
                          clarificationSummary={project.clarificationSummary}
                          onUpdated={() => void loadData()}
                        />
                      </section>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {inviteModalOpen && projectId && (
        <InviteFromDirectoryModal
          projectId={projectId}
          projectType={project?.projectType}
          onClose={() => setInviteModalOpen(false)}
        />
      )}

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          void (async () => {
            await refreshSession();
            await loadData();
          })();
        }}
      />
      {confirmDialog}
    </PageShell>
  );
}
