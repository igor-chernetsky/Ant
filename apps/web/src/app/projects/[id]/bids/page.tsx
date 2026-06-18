'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BidAnalysisPanel } from '@/components/BidAnalysisPanel';
import { BidApplicationCard } from '@/components/BidApplicationCard';
import { BidsCompareTable } from '@/components/BidsCompareTable';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import { fetchProject, type Project } from '@/lib/projects';
import {
  fetchProjectTender,
  formatTenderStatus,
  selectProjectBid,
  type Bid,
  type Tender,
} from '@/lib/tendering';

export default function ProjectBidsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();

  const [project, setProject] = useState<Project | null>(null);
  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!projectId || !sessionReady) return;

    setLoading(true);
    setError(null);

    if (!me) {
      setProject(null);
      setTender(null);
      setLoading(false);
      return;
    }

    try {
      const projectData = await fetchProject(projectId);
      setProject(projectData);
      const tenderData = await fetchProjectTender(projectId);
      setTender(tenderData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load bids');
      setProject(null);
      setTender(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, sessionReady, me]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSelectBid = async (bid: Bid) => {
    const confirmed = window.confirm(
      `Select bid from ${bid.companyName ?? 'contractor'}?`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const updated = await selectProjectBid(projectId, bid.id);
      setTender(updated);
      const projectData = await fetchProject(projectId);
      setProject(projectData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to select bid');
    } finally {
      setBusy(false);
    }
  };

  const ballparkMid = project?.estimate?.totals.midAmount ?? null;
  const projectHref = `/projects/${projectId}`;

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />

      <main className="content-container main-content">
        {!sessionReady || loading ? (
          <section className="card">
            <p className="muted">Loading bids…</p>
          </section>
        ) : null}

        {!loading && !me && (
          <section className="card">
            <p className="muted">Sign in to review bids for your project.</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              Sign in
            </button>
          </section>
        )}

        {error && (
          <section className="card error">
            <p>{error}</p>
            <Link href="/" className="text-link">
              Back to projects
            </Link>
          </section>
        )}

        {!loading && me && project && (
          <>
            <header className="project-bids-header">
              <p className="project-bids-kicker">
                <Link href="/" className="project-hero-back-link">
                  Projects
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
                <span>Bids</span>
              </p>
              <div className="project-bids-title-row">
                <h1 className="project-bids-title">Compare bids</h1>
                <Link href={projectHref} className="secondary project-bids-back">
                  Back to project
                </Link>
              </div>
              {tender && (
                <dl className="meta-grid tender-meta project-bids-meta">
                  <div>
                    <dt>Status</dt>
                    <dd>{formatTenderStatus(tender.status)}</dd>
                  </div>
                  <div>
                    <dt>Applications</dt>
                    <dd>{tender.applicationCount ?? tender.bids.length}</dd>
                  </div>
                  {tender.submittedBidCount > 0 && (
                    <div>
                      <dt>Proposals</dt>
                      <dd>{tender.submittedBidCount}</dd>
                    </div>
                  )}
                  {tender.closesAt && (
                    <div>
                      <dt>Closes</dt>
                      <dd>{new Date(tender.closesAt).toLocaleString()}</dd>
                    </div>
                  )}
                </dl>
              )}
            </header>

            {!tender ? (
              <section className="card">
                <p className="muted">
                  No tender published yet. Publish from the project page first.
                </p>
                <Link href={projectHref} className="primary">
                  Go to project
                </Link>
              </section>
            ) : (
              <>
                {tender.submittedBidCount >= 2 && (
                  <>
                    <BidAnalysisPanel
                      projectId={projectId}
                      submittedBidCount={tender.submittedBidCount}
                    />
                    <BidsCompareTable
                      bids={tender.bids.filter((b) => b.status === 'submitted')}
                      ballparkMid={ballparkMid}
                    />
                  </>
                )}

                <section className="card tender-card">
                  <h2 className="section-title">Applications</h2>
                  {tender.bids.length > 0 ? (
                    <ul className="bid-proposal-list">
                      {tender.bids.map((bid) => (
                        <BidApplicationCard
                          key={bid.id}
                          bid={bid}
                          ballparkMid={ballparkMid}
                          tenderStatus={tender.status}
                          busy={busy}
                          currentUserId={me.id}
                          projectId={projectId}
                          onSelect={handleSelectBid}
                          alwaysExpanded
                          clientCounterOffer={{
                            projectId,
                            tenderOpen:
                              tender.status === 'open' ||
                              tender.status === 'closed',
                          }}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
                      No applications yet. Contractors apply from the public
                      project page.
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>

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
    </PageShell>
  );
}
