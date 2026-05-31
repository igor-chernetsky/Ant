'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  approveAdminContractor,
  fetchAdminContractor,
  fetchAdminContractors,
  formatVerificationStatus,
  getAdminContractorDocumentUrl,
  isAdmin,
  rejectAdminContractor,
  type AdminContractorDetail,
  type AdminContractorListItem,
  type ContractorVerificationStatus,
} from '@/lib/verification';

const STATUS_FILTERS: Array<{
  value: ContractorVerificationStatus | '';
  label: string;
}> = [
  { value: 'awaiting_review', label: 'Awaiting review' },
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function AdminContractorsPage() {
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<ContractorVerificationStatus | ''>(
    'awaiting_review',
  );
  const [list, setList] = useState<AdminContractorListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminContractorDetail | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadList = useCallback(async () => {
    const items = await fetchAdminContractors(filter || undefined);
    setList(items);
  }, [filter]);

  useEffect(() => {
    if (!sessionReady) return;
    setReady(true);
    if (me && isAdmin(me.roles)) {
      void loadList().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load');
      });
    }
  }, [sessionReady, me, loadList]);

  useEffect(() => {
    if (!ready || !me || !isAdmin(me.roles)) return;
    void loadList().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load list');
    });
  }, [filter, ready, me, loadList]);

  const openDetail = async (contractorId: string) => {
    setBusy(true);
    setError(null);
    setRejectComment('');
    try {
      const data = await fetchAdminContractor(contractorId);
      setDetail(data);
      setSelectedId(contractorId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await approveAdminContractor(selectedId);
      await loadList();
      await openDetail(selectedId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await rejectAdminContractor(selectedId, rejectComment);
      await loadList();
      await openDetail(selectedId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDocOpen = async (documentId: string) => {
    if (!selectedId) return;
    try {
      const { downloadUrl } = await getAdminContractorDocumentUrl(
        selectedId,
        documentId,
      );
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open document');
    }
  };

  const handleLogout = async () => {
    await signOut();
    setList([]);
    setDetail(null);
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
          <h1>Contractor verification</h1>
          <p className="page-hero-lead muted">
            Review contractor profiles, documents, and approve or reject with
            feedback.
          </p>
        </section>

        {!ready && (
          <section className="card">
            <p className="muted">Loading…</p>
          </section>
        )}

        {ready && !me && (
          <section className="card cta">
            <p>Sign in with an admin account.</p>
            <button type="button" className="primary" onClick={() => setLoginOpen(true)}>
              Sign in
            </button>
          </section>
        )}

        {ready && me && !isAdmin(me.roles) && (
          <section className="card error">
            <p>Admin role required.</p>
            <Link href="/" className="text-link">
              Back to home
            </Link>
          </section>
        )}

        {ready && me && isAdmin(me.roles) && (
          <>
            <section className="card">
              <div className="tag-filter-list">
                {STATUS_FILTERS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={
                      filter === item.value
                        ? 'tag-filter-chip tag-filter-chip-active'
                        : 'tag-filter-chip'
                    }
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {list.length === 0 ? (
                <p className="muted">No contractors in this filter.</p>
              ) : (
                <ul className="admin-contractor-list">
                  {list.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="admin-contractor-row"
                        onClick={() => void openDetail(item.id)}
                      >
                        <div>
                          <strong>
                            {item.companyName ?? item.displayName ?? item.email}
                          </strong>
                          <p className="muted doc-meta">
                            {item.email ?? '—'} · {item.regionCode} ·{' '}
                            {item.documentCount} docs
                          </p>
                        </div>
                        <span className="status-pill">
                          {formatVerificationStatus(item.verificationStatus)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {detail && (
              <section className="card">
                <h2 className="section-title">Contractor details</h2>
                <dl className="meta-grid">
                  <div>
                    <dt>Name</dt>
                    <dd>{detail.displayName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{detail.email ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Company</dt>
                    <dd>{detail.companyName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Region</dt>
                    <dd>{detail.regionCode}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{formatVerificationStatus(detail.verificationStatus)}</dd>
                  </div>
                  <div>
                    <dt>Requested</dt>
                    <dd>
                      {detail.verificationRequestedAt
                        ? new Date(detail.verificationRequestedAt).toLocaleString()
                        : '—'}
                    </dd>
                  </div>
                </dl>

                <h3 className="tag-section-label">Documents</h3>
                {detail.documents.length === 0 ? (
                  <p className="muted">No documents.</p>
                ) : (
                  <ul className="doc-list">
                    {detail.documents.map((doc) => (
                      <li key={doc.id} className="doc-item">
                        <button
                          type="button"
                          className="doc-link"
                          onClick={() => void handleDocOpen(doc.id)}
                        >
                          {doc.originalName}
                        </button>
                        <p className="muted doc-meta">{doc.category}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {detail.verificationStatus === 'awaiting_review' && (
                  <div className="admin-review-actions">
                    <button
                      type="button"
                      className="primary"
                      disabled={busy}
                      onClick={() => void handleApprove()}
                    >
                      Approve
                    </button>
                    <label className="admin-reject-field">
                      Rejection comment
                      <textarea
                        rows={3}
                        value={rejectComment}
                        onChange={(e) => setRejectComment(e.target.value)}
                        placeholder="Explain what needs to be fixed…"
                      />
                    </label>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy || rejectComment.trim().length < 3}
                      onClick={() => void handleReject()}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {error && <p className="form-error">{error}</p>}
              </section>
            )}
          </>
        )}
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          void (async () => {
            const session = await refreshSession();
            if (session && isAdmin(session.roles)) {
              await loadList();
            }
          })();
        }}
      />
    </PageShell>
  );
}
