'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  fetchAdminClient,
  fetchAdminClients,
  type AdminClientDetail,
  type AdminClientListItem,
} from '@/lib/admin-clients';
import { formatThb } from '@/lib/estimate';
import { formatDateTime } from '@/lib/projects';
import { isAdmin } from '@/lib/verification';

function clientLabel(item: Pick<AdminClientListItem, 'displayName' | 'email'>) {
  return item.displayName?.trim() || item.email?.trim() || '—';
}

function localeLabel(
  locale: string,
  t: (key: string) => string,
): string {
  if (locale === 'en' || locale === 'ru' || locale === 'th') {
    return t(`header.lang_${locale}`);
  }
  return locale;
}

export default function AdminClientsPage() {
  return (
    <Suspense fallback={<AdminClientsFallback />}>
      <AdminClientsContent />
    </Suspense>
  );
}

function AdminClientsFallback() {
  const { t } = useTranslation();
  const { me, signOut } = useSession();
  return (
    <PageShell>
      <SiteHeader me={me} onSignIn={() => undefined} onSignOut={() => void signOut()} />
      <main className="admin-clients-page">
        <section className="card">
          <p className="muted">{t('common.loading')}</p>
        </section>
      </main>
    </PageShell>
  );
}

function AdminClientsContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get('id');
  const { formatProjectStatus, formatProjectType } = useAppFormatters();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [list, setList] = useState<AdminClientListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(initialClientId);
  const [detail, setDetail] = useState<AdminClientDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadList = useCallback(async (search = appliedQ) => {
    const page = await fetchAdminClients({
      q: search || undefined,
      limit: 100,
      offset: 0,
    });
    setList(page.items);
    setTotal(page.total);
    return page.items;
  }, [appliedQ]);

  const openDetail = useCallback(
    async (clientId: string) => {
      setBusy(true);
      setError(null);
      try {
        const data = await fetchAdminClient(clientId);
        setDetail(data);
        setSelectedId(clientId);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : t('admin.loadDetailsFailed'),
        );
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!sessionReady) return;
    setReady(true);
    if (!(me && isAdmin(me.roles))) return;
    void (async () => {
      try {
        const items = await loadList();
        if (initialClientId) {
          await openDetail(initialClientId);
          return;
        }
        if (items[0]) {
          await openDetail(items[0].id);
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : t('admin.loadListFailed'),
        );
      }
    })();
    // Initial admin load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, me]);

  useEffect(() => {
    if (!ready || !me || !isAdmin(me.roles)) return;
    if (selectedId && list.some((item) => item.id === selectedId)) return;
    if (list.length > 0 && !selectedId) {
      void openDetail(list[0].id);
    }
  }, [list, selectedId, ready, me, openDetail]);

  const applySearch = () => {
    const next = q.trim();
    setAppliedQ(next);
    setSelectedId(null);
    setDetail(null);
    void loadList(next)
      .then((items) => {
        if (items[0]) void openDetail(items[0].id);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : t('admin.loadListFailed'),
        );
      });
  };

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />

      <main className="admin-clients-page">
        <section className="admin-clients-hero">
          <div>
            <h1 className="page-title">{t('admin.clientsTitle')}</h1>
            <p className="muted">{t('admin.clientsLead')}</p>
          </div>
          {ready && me && isAdmin(me.roles) ? (
            <p className="admin-clients-count">
              {t('admin.projectsTableLoaded', {
                count: String(list.length),
                total: String(total),
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
          <section className="admin-clients-layout">
            <section className="card admin-clients-table-panel">
              <div className="admin-clients-search">
                <label className="admin-clients-search-field">
                  <span className="sr-only">{t('admin.clientsFilterSearch')}</span>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applySearch();
                    }}
                    placeholder={t('admin.clientsFilterSearchPh')}
                  />
                </label>
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={applySearch}
                >
                  {t('admin.projectsTableApply')}
                </button>
              </div>

              {error && !detail ? <p className="form-error">{error}</p> : null}

              {list.length === 0 ? (
                <p className="muted">{t('admin.clientsEmpty')}</p>
              ) : (
                <div className="admin-clients-table-wrap">
                  <table className="admin-clients-table">
                    <thead>
                      <tr>
                        <th>{t('admin.clientsColName')}</th>
                        <th>{t('admin.clientsColEmail')}</th>
                        <th>{t('admin.clientsColProjects')}</th>
                        <th>{t('admin.clientsColRegistered')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((item) => {
                        const active = selectedId === item.id;
                        return (
                          <tr
                            key={item.id}
                            className={
                              active
                                ? 'admin-clients-row admin-clients-row--active'
                                : 'admin-clients-row'
                            }
                            onClick={() => void openDetail(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                void openDetail(item.id);
                              }
                            }}
                            tabIndex={0}
                            aria-selected={active}
                          >
                            <td>
                              <strong>{clientLabel(item)}</strong>
                              {item.activeProjectCount > 0 ? (
                                <span className="admin-clients-active-badge">
                                  {t('admin.clientsActiveCount', {
                                    count: String(item.activeProjectCount),
                                  })}
                                </span>
                              ) : null}
                            </td>
                            <td className="muted">
                              {item.email || t('common.dash')}
                            </td>
                            <td>{item.projectCount}</td>
                            <td className="muted">
                              {formatDateTime(item.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card admin-clients-detail">
              {error && detail ? <p className="form-error">{error}</p> : null}
              {!detail ? (
                <div className="admin-clients-empty">
                  <p className="muted">{t('admin.clientsSelectPrompt')}</p>
                </div>
              ) : (
                <div className="admin-clients-detail-body">
                  <div className="admin-clients-detail-header">
                    <div>
                      <h2 className="section-title">
                        {t('admin.clientsDetails')}
                      </h2>
                      <strong className="admin-clients-name">
                        {clientLabel(detail)}
                      </strong>
                      {detail.email ? (
                        <p className="muted">
                          <a href={`mailto:${detail.email}`}>{detail.email}</a>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="admin-clients-blocks">
                    <section className="admin-clients-block">
                      <h3 className="tag-section-label">
                        {t('admin.clientsSectionOverview')}
                      </h3>
                      <dl className="meta-grid admin-clients-meta-grid">
                        <div>
                          <dt>{t('common.name')}</dt>
                          <dd>
                            {detail.displayName?.trim() || t('common.dash')}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('common.email')}</dt>
                          <dd>
                            {detail.email ? (
                              <a href={`mailto:${detail.email}`}>
                                {detail.email}
                              </a>
                            ) : (
                              t('common.dash')
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('admin.clientsLocale')}</dt>
                          <dd>{localeLabel(detail.preferredLocale, t)}</dd>
                        </div>
                        <div>
                          <dt>{t('admin.clientsRegistered')}</dt>
                          <dd>{formatDateTime(detail.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>{t('admin.clientsProjectsTotal')}</dt>
                          <dd>{detail.projectCount}</dd>
                        </div>
                        <div>
                          <dt>{t('admin.clientsLastActivity')}</dt>
                          <dd>
                            {detail.lastProjectAt
                              ? formatDateTime(detail.lastProjectAt)
                              : t('common.dash')}
                          </dd>
                        </div>
                      </dl>

                      <h4 className="admin-clients-block-subtitle">
                        {t('admin.clientsLegalTitle')}
                      </h4>
                      {detail.legal ? (
                        <dl className="meta-grid admin-clients-meta-grid">
                          <div>
                            <dt>{t('admin.clientsEmployerName')}</dt>
                            <dd>
                              {detail.legal.employerName || t('common.dash')}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('admin.clientsEmployerAddress')}</dt>
                            <dd>
                              {detail.legal.employerAddress ||
                                t('common.dash')}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('admin.clientsEmployerRegNo')}</dt>
                            <dd>
                              {detail.legal.employerRegistrationNo ||
                                t('common.dash')}
                            </dd>
                          </div>
                          {detail.legal.sourceProjectTitle ? (
                            <div>
                              <dt>{t('admin.clientsLegalSource')}</dt>
                              <dd>{detail.legal.sourceProjectTitle}</dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : (
                        <p className="muted">{t('admin.clientsLegalEmpty')}</p>
                      )}
                    </section>

                    <section className="admin-clients-block">
                      <h3 className="tag-section-label">
                        {t('admin.clientsSectionProjects')}
                      </h3>
                      {detail.projects.length === 0 ? (
                        <p className="muted">
                          {t('admin.clientsProjectsEmpty')}
                        </p>
                      ) : (
                        <ul className="admin-clients-project-list">
                          {detail.projects.map((project) => (
                            <li key={project.id}>
                              <div className="admin-clients-project-row">
                                <div>
                                  <Link
                                    href={`/projects/${encodeURIComponent(project.id)}`}
                                    className="admin-clients-project-title"
                                  >
                                    {project.title}
                                  </Link>
                                  <p className="muted doc-meta">
                                    {formatProjectType(project.projectType)} ·{' '}
                                    {formatProjectStatus(project.status)}
                                    {project.isHidden
                                      ? ` · ${t('admin.projectsTableHiddenBadge')}`
                                      : ''}
                                  </p>
                                  <p className="muted doc-meta">
                                    {t('admin.projectsTableColContractAmount')}
                                    :{' '}
                                    {project.contractAmount != null
                                      ? formatThb(project.contractAmount)
                                      : t('common.dash')}
                                    {' · '}
                                    {t('admin.projectsTableColSigned')}:{' '}
                                    {project.contractFullySignedAt
                                      ? formatDateTime(
                                          project.contractFullySignedAt,
                                        )
                                      : t('common.dash')}
                                  </p>
                                </div>
                                <Link
                                  href={`/projects/${encodeURIComponent(project.id)}`}
                                  className="text-link"
                                >
                                  {t('admin.projectsTableOpen')}
                                </Link>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="admin-clients-block admin-clients-block--billing">
                      <h3 className="tag-section-label">
                        {t('admin.clientsBillingTitle')}
                      </h3>
                      <div className="admin-clients-billing-grid">
                        <div className="admin-clients-billing-card">
                          <h4>{t('admin.clientsSectionInvoices')}</h4>
                          <p className="muted">
                            {t('admin.clientsInvoicesPlaceholder')}
                          </p>
                        </div>
                        <div className="admin-clients-billing-card">
                          <h4>{t('admin.clientsSectionVat')}</h4>
                          <p className="muted">
                            {t('admin.clientsVatPlaceholder')}
                          </p>
                        </div>
                        <div className="admin-clients-billing-card">
                          <h4>{t('admin.clientsSectionPayment')}</h4>
                          <p className="muted">
                            {t('admin.clientsPaymentPlaceholder')}
                          </p>
                          {detail.paymentSlipCount > 0 ? (
                            <p className="muted">
                              {t('admin.clientsPaymentSlipsHint', {
                                count: String(detail.paymentSlipCount),
                              })}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
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
