'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  approveAdminContractor,
  fetchAdminContractor,
  fetchAdminContractors,
  getAdminContractorDocumentUrl,
  isAdmin,
  rejectAdminContractor,
  type AdminContractorDetail,
  type AdminContractorListItem,
  type ContractorVerificationStatus,
} from '@/lib/verification';

export default function AdminContractorsPage() {
  const { t } = useTranslation();
  const { formatVerificationStatus, formatDocumentCategory } = useAppFormatters();
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

  const statusFilters: Array<{
    value: ContractorVerificationStatus | '';
    labelKey: string;
  }> = [
    { value: 'awaiting_review', labelKey: 'admin.filterAwaitingReview' },
    { value: 'verified', labelKey: 'admin.filterVerified' },
    { value: 'pending', labelKey: 'admin.filterPending' },
    { value: 'rejected', labelKey: 'admin.filterRejected' },
    { value: '', labelKey: 'admin.filterAll' },
  ];

  const loadList = useCallback(async () => {
    const items = await fetchAdminContractors(filter || undefined);
    setList(items);
  }, [filter]);

  useEffect(() => {
    if (!sessionReady) return;
    setReady(true);
    if (me && isAdmin(me.roles)) {
      void loadList().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('common.loadFailed'));
      });
    }
  }, [sessionReady, me, loadList, t]);

  useEffect(() => {
    if (!ready || !me || !isAdmin(me.roles)) return;
    void loadList().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t('admin.loadListFailed'));
    });
  }, [filter, ready, me, loadList, t]);

  const openDetail = async (contractorId: string) => {
    setBusy(true);
    setError(null);
    setRejectComment('');
    try {
      const data = await fetchAdminContractor(contractorId);
      setDetail(data);
      setSelectedId(contractorId);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('admin.loadDetailsFailed'),
      );
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
      setError(err instanceof Error ? err.message : t('admin.approveFailed'));
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
      setError(err instanceof Error ? err.message : t('admin.rejectFailed'));
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
      setError(
        err instanceof Error ? err.message : t('admin.openDocumentFailed'),
      );
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
          <h1>{t('admin.verificationTitle')}</h1>
          <p className="page-hero-lead muted">{t('admin.verificationLead')}</p>
        </section>

        {!ready && (
          <section className="card">
            <p className="muted">{t('common.loading')}</p>
          </section>
        )}

        {ready && !me && (
          <section className="card cta">
            <p>{t('admin.signInPrompt')}</p>
            <button type="button" className="primary" onClick={() => setLoginOpen(true)}>
              {t('header.signIn')}
            </button>
          </section>
        )}

        {ready && me && !isAdmin(me.roles) && (
          <section className="card error">
            <p>{t('admin.roleRequired')}</p>
            <Link href="/" className="text-link">
              {t('common.backToHome')}
            </Link>
          </section>
        )}

        {ready && me && isAdmin(me.roles) && (
          <>
            <section className="card">
              <div className="tag-filter-list">
                {statusFilters.map((item) => (
                  <button
                    key={item.labelKey}
                    type="button"
                    className={
                      filter === item.value
                        ? 'tag-filter-chip tag-filter-chip-active'
                        : 'tag-filter-chip'
                    }
                    onClick={() => setFilter(item.value)}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>

              {list.length === 0 ? (
                <p className="muted">{t('admin.noContractors')}</p>
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
                            {item.email ?? t('common.dash')} · {item.regionCode}{' '}
                            · {item.documentCount} {t('common.docs')}
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
                <h2 className="section-title">{t('admin.contractorDetails')}</h2>
                <dl className="meta-grid">
                  <div>
                    <dt>{t('common.name')}</dt>
                    <dd>{detail.displayName ?? t('common.dash')}</dd>
                  </div>
                  <div>
                    <dt>{t('common.email')}</dt>
                    <dd>{detail.email ?? t('common.dash')}</dd>
                  </div>
                  <div>
                    <dt>{t('common.company')}</dt>
                    <dd>{detail.companyName ?? t('common.dash')}</dd>
                  </div>
                  <div>
                    <dt>{t('common.region')}</dt>
                    <dd>{detail.regionCode}</dd>
                  </div>
                  <div>
                    <dt>{t('common.status')}</dt>
                    <dd>{formatVerificationStatus(detail.verificationStatus)}</dd>
                  </div>
                  <div>
                    <dt>{t('common.requested')}</dt>
                    <dd>
                      {detail.verificationRequestedAt
                        ? new Date(detail.verificationRequestedAt).toLocaleString()
                        : t('common.dash')}
                    </dd>
                  </div>
                </dl>

                <h3 className="tag-section-label">{t('admin.documents')}</h3>
                {detail.documents.length === 0 ? (
                  <p className="muted">{t('admin.noDocuments')}</p>
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
                        <p className="muted doc-meta">
                          {formatDocumentCategory(doc.category)}
                        </p>
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
                      {t('admin.approve')}
                    </button>
                    <label className="admin-reject-field">
                      {t('admin.rejectionComment')}
                      <textarea
                        rows={3}
                        value={rejectComment}
                        onChange={(e) => setRejectComment(e.target.value)}
                        placeholder={t('admin.rejectionPlaceholder')}
                      />
                    </label>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy || rejectComment.trim().length < 3}
                      onClick={() => void handleReject()}
                    >
                      {t('admin.reject')}
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
