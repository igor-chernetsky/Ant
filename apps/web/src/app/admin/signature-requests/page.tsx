'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import { isAdmin } from '@/lib/verification';
import {
  approveAdminSignatureRequest,
  fetchAdminSignatureRequests,
  rejectAdminSignatureRequest,
  type SignatureRequestListItem,
  type SignatureRequestStatus,
} from '@/lib/signature-requests';
import { formatPlatformMoney, formatUsd } from '@/lib/platform-fees';

export default function AdminSignatureRequestsPage() {
  const { t, locale } = useTranslation();
  const { me, ready: sessionReady, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<SignatureRequestStatus | ''>('pending');
  const [list, setList] = useState<SignatureRequestListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const statusFilters: Array<{
    value: SignatureRequestStatus | '';
    labelKey: string;
  }> = [
    { value: 'pending', labelKey: 'admin.sigFilterPending' },
    { value: 'approved', labelKey: 'admin.sigFilterApproved' },
    { value: 'rejected', labelKey: 'admin.sigFilterRejected' },
    { value: '', labelKey: 'admin.filterAll' },
  ];

  const loadList = useCallback(async () => {
    const items = await fetchAdminSignatureRequests(filter || undefined);
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

  const selected = list.find((item) => item.id === selectedId) ?? null;

  const handleApprove = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await approveAdminSignatureRequest(selectedId);
      await loadList();
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
      await rejectAdminSignatureRequest(selectedId, rejectReason);
      setRejectReason('');
      await loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('admin.rejectFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setList([]);
    setSelectedId(null);
  };

  const statusLabel = (status: SignatureRequestStatus) => {
    if (status === 'pending') return t('admin.sigStatusPending');
    if (status === 'approved') return t('admin.sigStatusApproved');
    return t('admin.sigStatusRejected');
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
          <h1>{t('admin.signatureRequestsTitle')}</h1>
          <p className="page-hero-lead muted">
            {t('admin.signatureRequestsLead')}
          </p>
        </section>

        {!ready && (
          <section className="card">
            <p className="muted">{t('common.loading')}</p>
          </section>
        )}

        {ready && !me && (
          <section className="card cta">
            <p>{t('admin.signInPrompt')}</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
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
              <div
                className="admin-filter-bar"
                role="group"
                aria-label={t('admin.filterAll')}
              >
                {statusFilters.map((item) => (
                  <button
                    key={item.value || 'all'}
                    type="button"
                    className={
                      filter === item.value
                        ? 'admin-filter-chip admin-filter-chip-active'
                        : 'admin-filter-chip'
                    }
                    aria-pressed={filter === item.value}
                    onClick={() => setFilter(item.value)}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>
              {error && <p className="error">{error}</p>}
              {list.length === 0 ? (
                <p className="muted">{t('admin.sigEmpty')}</p>
              ) : (
                <ul className="admin-contractor-list">
                  {list.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="admin-contractor-row"
                        onClick={() => {
                          setSelectedId(item.id);
                          setRejectReason('');
                        }}
                      >
                        <div>
                          <strong>
                            {item.companyName || t('header.contractor')}
                          </strong>
                          <p className="muted doc-meta">
                            {item.projectTitle} · {statusLabel(item.status)}
                          </p>
                        </div>
                        <span className="status-pill">
                          {statusLabel(item.status)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {selected && (
              <section className="card">
                <h2>{t('admin.sigDetails')}</h2>
                <dl className="meta-grid">
                  <div>
                    <dt>{t('admin.sigProject')}</dt>
                    <dd>
                      <Link
                        href={`/projects/${selected.projectId}`}
                        className="text-link"
                      >
                        {selected.projectTitle}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>{t('admin.sigStatus')}</dt>
                    <dd>{statusLabel(selected.status)}</dd>
                  </div>
                  <div>
                    <dt>{t('admin.sigContractor')}</dt>
                    <dd>
                      {selected.companyName || t('common.dash')}
                      {selected.contractorEmail
                        ? ` · ${selected.contractorEmail}`
                        : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('admin.sigBank')}</dt>
                    <dd>
                      {selected.bankName || t('common.dash')} /{' '}
                      {selected.bankAccount || t('common.dash')}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('admin.sigContractAmount')}</dt>
                    <dd>
                      {selected.contractAmount != null
                        ? formatPlatformMoney(
                            selected.contractAmount,
                            selected.currency,
                            locale,
                          )
                        : t('common.dash')}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('admin.sigDueNow')}</dt>
                    <dd>
                      {selected.dueNowListed != null
                        ? formatPlatformMoney(
                            selected.dueNowListed,
                            selected.currency,
                            locale,
                          )
                        : formatUsd(selected.accessFeeUsd, locale)}
                      {selected.trialActive
                        ? ` → ${formatPlatformMoney(0, selected.currency, locale)} (${t('platformFees.trialPill')})`
                        : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('admin.sigRequestedAt')}</dt>
                    <dd>
                      {new Date(selected.createdAt).toLocaleString(locale)}
                    </dd>
                  </div>
                  {selected.rejectionReason ? (
                    <div>
                      <dt>{t('admin.rejectionComment')}</dt>
                      <dd>{selected.rejectionReason}</dd>
                    </div>
                  ) : null}
                </dl>

                {selected.status === 'pending' && (
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
                      <span>{t('admin.rejectionComment')}</span>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                        placeholder={t('admin.rejectionPlaceholder')}
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy || !rejectReason.trim()}
                      onClick={() => void handleReject()}
                    >
                      {t('admin.reject')}
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => setLoginOpen(false)}
      />
    </PageShell>
  );
}
