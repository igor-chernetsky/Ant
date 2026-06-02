'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BidProposalForm } from '@/components/BidProposalForm';
import { ContractorVerificationPanel } from '@/components/ContractorVerificationPanel';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import { fetchPublicProject } from '@/lib/public-projects';
import {
  fetchContractorInvitations,
  fetchContractorProfile,
  fetchContractorTender,
  formatTenderStatus,
  respondContractorInvitation,
  submitContractorBid,
  upsertContractorProfile,
  withdrawContractorBid,
  type ContractorInvitationItem,
  type ContractorProfile,
  type ContractorTenderView,
} from '@/lib/tendering';

interface HeroProjectPreview {
  title: string;
  district: string | null;
  description: string | null;
}

export default function ContractorPage() {
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [invitations, setInvitations] = useState<ContractorInvitationItem[]>(
    [],
  );
  const [companyName, setCompanyName] = useState('');
  const [regionCode, setRegionCode] = useState('TH');
  const [activeTenderId, setActiveTenderId] = useState<string | null>(null);
  const [tenderView, setTenderView] = useState<ContractorTenderView | null>(
    null,
  );
  const [heroProject, setHeroProject] = useState<HeroProjectPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setError(null);
    if (!sessionReady) return;
    if (!me) {
      setReady(true);
      return;
    }

    const [prof, invs] = await Promise.all([
      fetchContractorProfile(),
      fetchContractorInvitations(),
    ]);
    setProfile(prof);
    setInvitations(invs);
    if (prof?.companyName) setCompanyName(prof.companyName);
    if (prof?.regionCode) setRegionCode(prof.regionCode);
    setReady(true);
  }, [me, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
    loadAll().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setReady(true);
    });
  }, [sessionReady, loadAll]);

  const loadTenderView = async (tenderId: string) => {
    setBusy(true);
    setError(null);
    try {
      const view = await fetchContractorTender(tenderId);
      setTenderView(view);
      setActiveTenderId(tenderId);
      const invitation = invitations.find((inv) => inv.tenderId === tenderId);
      if (invitation) {
        try {
          const project = await fetchPublicProject(invitation.projectId);
          setHeroProject({
            title: project.title,
            district: project.district,
            description: project.description,
          });
        } catch {
          setHeroProject({
            title: invitation.projectTitle,
            district: invitation.projectDistrict,
            description: null,
          });
        }
      } else {
        setHeroProject(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tender');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    setBusy(true);
    setError(null);
    try {
      const prof = await upsertContractorProfile({
        companyName: companyName.trim() || undefined,
        regionCode: regionCode.trim() || 'TH',
      });
      setProfile(prof);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRespond = async (tenderId: string, accept: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await respondContractorInvitation(tenderId, accept);
      const invs = await fetchContractorInvitations();
      setInvitations(invs);
      if (activeTenderId === tenderId) {
        await loadTenderView(tenderId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to respond');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitBid = async (
    input: Parameters<typeof submitContractorBid>[1],
  ) => {
    if (!activeTenderId) return;
    setBusy(true);
    setError(null);
    try {
      await submitContractorBid(activeTenderId, input);
      await loadTenderView(activeTenderId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!activeTenderId) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawContractorBid(activeTenderId);
      await loadTenderView(activeTenderId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw bid');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setProfile(null);
    setInvitations([]);
    setTenderView(null);
  };

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main className="content-container main-content">
        <section className="page-hero">
          <h1>Contractor portal</h1>
          <p className="page-hero-lead muted">
            Register as a contractor, respond to tender invitations, and submit
            bids on client projects.
          </p>
        </section>

        {!ready && (
          <section className="card">
            <p className="muted">Loading…</p>
          </section>
        )}

        {ready && !me && (
          <section className="card cta">
            <p>Sign in to access contractor invitations and submit bids.</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              Sign in
            </button>
          </section>
        )}

        {ready && me && !profile && (
          <section className="card">
            <h2 className="section-title">Register as contractor</h2>
            <p className="muted doc-hint">
              MVP auto-creates your profile as pending. Upload documents and
              request approval below.
            </p>
            <div className="modal-form">
              <label>
                Company name
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company"
                />
              </label>
              <label>
                Region code
                <input
                  value={regionCode}
                  onChange={(e) => setRegionCode(e.target.value)}
                  placeholder="TH"
                />
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void handleRegister()}
            >
              {busy ? 'Saving…' : 'Create contractor profile'}
            </button>
          </section>
        )}

        {ready && me && profile && (
          <>
            <section className="card">
              <h2 className="section-title">Your profile</h2>
              <p className="muted">
                {profile.companyName ?? 'Unnamed company'} · {profile.regionCode}
              </p>
            </section>

            <ContractorVerificationPanel
              profile={profile}
              onProfileUpdated={setProfile}
            />

            {profile.verificationStatus !== 'verified' ? (
              <section className="card">
                <p className="muted">
                  Tender invitations and bids unlock after admin verification.
                </p>
              </section>
            ) : (
              <>
            <section className="card">
              <h2 className="section-title">Invitations</h2>
              {invitations.length === 0 ? (
                <p className="muted">
                  No invitations yet. Matching uses your region (
                  {profile.regionCode}). Create tenders from client projects
                  after estimation.
                </p>
              ) : (
                <ul className="tender-invite-list">
                  {invitations.map((inv) => (
                    <li key={inv.invitationId} className="tender-invite-item">
                      <div>
                        <strong>{inv.projectTitle}</strong>
                        <p className="muted doc-meta">
                          {inv.projectDistrict ?? inv.projectId} ·{' '}
                          {formatTenderStatus(inv.tenderStatus)} · invitation{' '}
                          {inv.invitationStatus}
                        </p>
                      </div>
                      <div className="bid-line-actions">
                        <Link
                          href={`/projects/${inv.projectId}`}
                          className="text-link"
                        >
                          View project
                        </Link>
                        {inv.invitationStatus === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                void handleRespond(inv.tenderId, true)
                              }
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                void handleRespond(inv.tenderId, false)
                              }
                            >
                              Decline
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => void loadTenderView(inv.tenderId)}
                        >
                          Manage bid
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {tenderView && (
              <section className="card">
                {heroProject && (
                  <section className="contractor-project-hero">
                    <div className="contractor-project-hero-overlay">
                      <p className="contractor-project-hero-kicker">Project brief</p>
                      <h3>{heroProject.title}</h3>
                      {heroProject.district && (
                        <p className="contractor-project-hero-meta">
                          District: {heroProject.district}
                        </p>
                      )}
                      <p className="contractor-project-hero-description">
                        {heroProject.description?.trim() ||
                          'The client is collecting contractor proposals for this project. Submit your bid with approach, scope, and timeline details.'}
                      </p>
                    </div>
                  </section>
                )}
                <h2 className="section-title">Submit bid &amp; proposal</h2>
                <p className="muted doc-hint">
                  Tender status: {formatTenderStatus(tenderView.tender.status)}
                  {tenderView.tender.closesAt &&
                    ` · closes ${new Date(tenderView.tender.closesAt).toLocaleString()}`}
                </p>

                {tenderView.invitation.status !== 'accepted' ? (
                  <p className="muted">
                    Accept the invitation before submitting a bid.
                  </p>
                ) : tenderView.tender.status !== 'open' ? (
                  <p className="muted">
                    Bidding opens when the client starts the tender.
                  </p>
                ) : (
                  <BidProposalForm
                    key={`${activeTenderId}-${tenderView.myBid?.submittedAt ?? 'new'}`}
                    existingBid={tenderView.myBid}
                    busy={busy}
                    onSubmit={handleSubmitBid}
                    onWithdraw={handleWithdraw}
                  />
                )}
                {error && <p className="form-error">{error}</p>}
              </section>
            )}
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
            await loadAll();
          })();
        }}
      />
    </PageShell>
  );
}
