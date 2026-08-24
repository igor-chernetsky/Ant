'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  type SupplyProfileKind,
} from '@/lib/verification';

type FilterKey = ContractorVerificationStatus | '' | 'new_contractor';

export default function AdminContractorsPage() {
  const { t } = useTranslation();
  const { formatVerificationStatus, formatDocumentCategory } = useAppFormatters();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('awaiting_review');
  const [list, setList] = useState<AdminContractorListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminContractorDetail | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>(
    {},
  );

  const statusFilters: Array<{
    value: FilterKey;
    labelKey: string;
  }> = [
    { value: 'awaiting_review', labelKey: 'admin.filterAwaitingReview' },
    { value: 'new_contractor', labelKey: 'admin.filterNewContractor' },
    { value: 'verified', labelKey: 'admin.filterVerified' },
    { value: 'rejected', labelKey: 'admin.filterRejected' },
    { value: '', labelKey: 'admin.filterAll' },
  ];

  const statusQuery = filter === 'new_contractor' ? 'pending' : filter || undefined;

  const loadList = useCallback(async () => {
    const items = await fetchAdminContractors(statusQuery);
    setList(items);
  }, [statusQuery]);

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
  }, [ready, me, loadList, t]);

  const filteredList = useMemo(() => {
    if (filter !== 'new_contractor') return list;
    return list.filter((item) => item.verificationStatus === 'pending');
  }, [filter, list]);

  const hasDesigners = filteredList.some((item) => item.kind === 'designer');

  const formatRoleLabel = (kind: SupplyProfileKind) =>
    kind === 'designer'
      ? t('admin.directoryKindDesigner')
      : t('admin.directoryKindContractor');

  const isImageDocument = (contentType: string) =>
    contentType.toLowerCase().startsWith('image/');

  const openDetail = async (contractorId: string) => {
    setBusy(true);
    setError(null);
    setRejectComment('');
    setImagePreviews({});
    try {
      const data = await fetchAdminContractor(contractorId);
      setDetail(data);
      setSelectedId(contractorId);

      const imageDocs = data.documents.filter(
        (doc) =>
          doc.status === 'uploaded' && isImageDocument(doc.contentType),
      );
      if (imageDocs.length > 0) {
        const entries = await Promise.all(
          imageDocs.map(async (doc) => {
            try {
              const { downloadUrl } = await getAdminContractorDocumentUrl(
                contractorId,
                doc.id,
              );
              return [doc.id, downloadUrl] as const;
            } catch {
              return null;
            }
          }),
        );
        const next: Record<string, string> = {};
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1];
        }
        setImagePreviews(next);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('admin.loadDetailsFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (selectedId && !filteredList.some((item) => item.id === selectedId)) {
      setSelectedId(null);
      setDetail(null);
      setImagePreviews({});
      return;
    }
    if (!selectedId && filteredList.length > 0) {
      void openDetail(filteredList[0].id);
    }
  }, [filteredList, selectedId]);

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
    setImagePreviews({});
  };

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main className="admin-verification-page">
        <section className="admin-verification-hero">
          <div>
            <h1 className="page-title">{t('admin.verificationTitle')}</h1>
            <p className="muted">{t('admin.verificationLead')}</p>
          </div>
          {ready && me && isAdmin(me.roles) ? (
            <p className="admin-verification-count">
              {t('admin.projectsTableLoaded', {
                count: String(filteredList.length),
                total: String(filteredList.length),
              })}
            </p>
          ) : null}
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
          <section className="admin-verification-layout">
            <section className="card admin-verification-sidebar">
              <div
                className="admin-filter-bar"
                role="group"
                aria-label={t('admin.filterAll')}
              >
                {statusFilters.map((item) => (
                  <button
                    key={item.labelKey}
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

              {filteredList.length === 0 ? (
                <p className="muted">{t('admin.noContractors')}</p>
              ) : (
                <ul className="admin-contractor-list">
                  {filteredList.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`admin-contractor-row${
                          selectedId === item.id ? ' admin-contractor-row--active' : ''
                        }`}
                        onClick={() => void openDetail(item.id)}
                      >
                        <div className="admin-contractor-row-main">
                          <div className="admin-contractor-row-top">
                            <strong>
                              {item.companyName ?? item.displayName ?? item.email}
                            </strong>
                            <span className="status-pill">
                              {formatVerificationStatus(item.verificationStatus)}
                            </span>
                          </div>
                          <p className="muted doc-meta">
                            {item.email ?? t('common.dash')} · {item.regionCode}{' '}
                            · {item.documentCount} {t('common.docs')}
                          </p>
                          {hasDesigners ? (
                            <div className="admin-contractor-role-row">
                              <span
                                className={`admin-role-pill admin-role-pill--${item.kind}`}
                              >
                                {formatRoleLabel(item.kind)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card admin-verification-detail">
              {error && <p className="form-error">{error}</p>}
              {!detail ? (
                <div className="admin-verification-empty">
                  <p className="muted">{t('admin.selectContractorPrompt')}</p>
                </div>
              ) : (
                <>
                  <div className="admin-verification-detail-header">
                    <div>
                      <h2 className="section-title">{t('admin.contractorDetails')}</h2>
                      <div className="admin-verification-name-row">
                        <strong className="admin-verification-name">
                          {detail.companyName ?? detail.displayName ?? detail.email}
                        </strong>
                        <span
                          className={`admin-role-pill admin-role-pill--${detail.kind}`}
                        >
                          {formatRoleLabel(detail.kind)}
                        </span>
                      </div>
                    </div>
                    <span className="status-pill">
                      {formatVerificationStatus(detail.verificationStatus)}
                    </span>
                  </div>

                  <dl className="meta-grid admin-verification-meta-grid">
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
                      <dt>{t('common.phone')}</dt>
                      <dd>{detail.phone?.trim() ? detail.phone : t('common.dash')}</dd>
                    </div>
                    <div>
                      <dt>{t('contractor.taxIdLabel')}</dt>
                      <dd>
                        {detail.taxId?.trim() ? detail.taxId : t('common.dash')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('common.region')}</dt>
                      <dd>{detail.regionCode}</dd>
                    </div>
                    <div>
                      <dt>{t('contractor.preferredContactLabel')}</dt>
                      <dd>
                        {detail.preferredContactMethods?.length
                          ? detail.preferredContactMethods
                              .map((method) =>
                                t(`contractor.contactMethod_${method}`),
                              )
                              .join(', ')
                          : t('common.dash')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('contractor.bankNameLabel')}</dt>
                      <dd>
                        {detail.bankName?.trim() ? detail.bankName : t('common.dash')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('contractor.bankAccountLabel')}</dt>
                      <dd>
                        {detail.bankAccount?.trim()
                          ? detail.bankAccount
                          : t('common.dash')}
                      </dd>
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
                    <ul className="admin-verification-doc-list">
                      {detail.documents.map((doc) => {
                        const previewUrl = imagePreviews[doc.id];
                        const showPreview =
                          isImageDocument(doc.contentType) && Boolean(previewUrl);
                        return (
                          <li key={doc.id} className="admin-verification-doc-item">
                            {showPreview ? (
                              <button
                                type="button"
                                className="admin-verification-doc-preview"
                                onClick={() => void handleDocOpen(doc.id)}
                                aria-label={doc.originalName}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={previewUrl}
                                  alt={doc.originalName}
                                  loading="lazy"
                                />
                              </button>
                            ) : null}
                            <div className="admin-verification-doc-meta">
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
                            </div>
                          </li>
                        );
                      })}
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
                          rows={4}
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
                </>
              )}
            </section>
          </section>
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
