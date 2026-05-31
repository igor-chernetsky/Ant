'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ContractorVerificationPanel } from '@/components/ContractorVerificationPanel';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { formatThb } from '@/lib/estimate';
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
import {
  fetchSessionProfile,
  logoutSession,
  type MeResponse,
} from '@/lib/session';

export default function ContractorPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
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
  const [bidAmount, setBidAmount] = useState('');
  const [bidDuration, setBidDuration] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setError(null);
    const session = await fetchSessionProfile();
    if (!session) {
      setMe(null);
      setReady(true);
      return;
    }

    setMe(session);
    const [prof, invs] = await Promise.all([
      fetchContractorProfile(),
      fetchContractorInvitations(),
    ]);
    setProfile(prof);
    setInvitations(invs);
    if (prof?.companyName) setCompanyName(prof.companyName);
    if (prof?.regionCode) setRegionCode(prof.regionCode);
    setReady(true);
  }, []);

  useEffect(() => {
    loadAll().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setReady(true);
    });
  }, [loadAll]);

  const loadTenderView = async (tenderId: string) => {
    setBusy(true);
    setError(null);
    try {
      const view = await fetchContractorTender(tenderId);
      setTenderView(view);
      setActiveTenderId(tenderId);
      if (view.myBid) {
        setBidAmount(view.myBid.amount);
        setBidDuration(view.myBid.durationDays?.toString() ?? '');
        setBidNotes(view.myBid.terms?.notes ?? '');
      } else {
        setBidAmount('');
        setBidDuration('');
        setBidNotes('');
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

  const handleSubmitBid = async () => {
    if (!activeTenderId) return;
    const amount = Number(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid bid amount');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await submitContractorBid(activeTenderId, {
        amount,
        durationDays: bidDuration ? Number(bidDuration) : undefined,
        notes: bidNotes.trim() || undefined,
      });
      await loadTenderView(activeTenderId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid');
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
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await logoutSession();
    setMe(null);
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
                <h2 className="section-title">Submit bid</h2>
                <p className="muted">
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
                  <>
                    <div className="modal-form">
                      <label>
                        Total amount (THB)
                        <input
                          type="number"
                          min="1"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                        />
                      </label>
                      <label>
                        Duration (days)
                        <input
                          type="number"
                          min="1"
                          value={bidDuration}
                          onChange={(e) => setBidDuration(e.target.value)}
                        />
                      </label>
                      <label>
                        Notes
                        <textarea
                          rows={3}
                          value={bidNotes}
                          onChange={(e) => setBidNotes(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="tender-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={busy}
                        onClick={() => void handleSubmitBid()}
                      >
                        {busy
                          ? 'Submitting…'
                          : tenderView.myBid
                            ? 'Update bid'
                            : 'Submit bid'}
                      </button>
                      {tenderView.myBid?.status === 'submitted' && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => void handleWithdraw()}
                        >
                          Withdraw bid
                        </button>
                      )}
                    </div>
                    {tenderView.myBid && (
                      <p className="muted">
                        Current bid: {formatThb(Number(tenderView.myBid.amount))}
                      </p>
                    )}
                  </>
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
          void loadAll();
        }}
      />
    </PageShell>
  );
}
