'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { DocumentTile, OrphanScopePackages } from '@/components/DocumentTile';
import { ClientAmendments } from '@/components/ClientAmendments';
import {
  EstimateRefinementPanel,
  ESTIMATE_REFINE_SECTION_ID,
} from '@/components/EstimateRefinementPanel';
import { EstimateConfidenceRing } from '@/components/EstimateConfidenceRing';
import { isAmendableProjectStatus } from '@/lib/amendments';
import { ContractorProjectPanel } from '@/components/ContractorProjectPanel';
import { IntakeWizard } from '@/components/IntakeWizard';
import { ProjectHero, ProjectHeroSidebar } from '@/components/ProjectHero';
import { ProjectBriefCard } from '@/components/ProjectBriefCard';
import { SiteHeader } from '@/components/SiteHeader';
import { TenderSummaryCard } from '@/components/TenderSummaryCard';
import { InviteFromDirectoryModal } from '@/components/InviteFromDirectoryModal';
import { ClientContractPanel, isContractProjectStatus } from '@/components/ClientContractPanel';
import { useTranslation } from '@/components/LocaleProvider';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { isTenderEligibleProjectStatus } from '@/lib/tendering';
import {
  DOCUMENT_CATEGORY_OPTIONS,
  deleteProjectDocument,
  fetchProjectDocuments,
  fetchPublicProjectDocuments,
  getDocumentDownloadUrl,
  getPublicDocumentDownloadUrl,
  MAX_UPLOAD_BYTES,
  uploadProjectDocument,
  type DocumentCategory,
  type ProjectDocument,
} from '@/lib/documents';
import { formatThb, isLowEstimateConfidence } from '@/lib/estimate';
import type { BallparkEstimate } from '@/lib/estimate';
import { isIntakeActive } from '@/lib/intake';
import { isSessionExpiredError } from '@/lib/auth-client';
import {
  fetchProject,
  formatDateTime,
  deleteProject,
  canDeleteProject,
  canDeleteDocument,
  canManageProjectLifecycle,
  type Project,
} from '@/lib/projects';
import { ProjectLifecyclePanel } from '@/components/ProjectLifecyclePanel';
import { useSession } from '@/components/SessionProvider';
import { isContractorUser, isDesignerUser, isAdminUser } from '@/lib/session';
import {
  fetchPublicProject,
  fetchContractorParticipantProject,
} from '@/lib/public-projects';

type AuthState = 'loading' | 'guest' | 'authenticated';

function guessContentType(file: File): string | null {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    zip: 'application/zip',
  };
  return ext ? (map[ext] ?? null) : null;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { formatDocumentCategory } = useAppFormatters();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const projectId = params.id;
  const inviteToken = searchParams.get('invite');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [authState, setAuthState] = useState<AuthState>('loading');
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [docCategory, setDocCategory] = useState<DocumentCategory>('blueprint');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [adminInviteOpen, setAdminInviteOpen] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const loadDocuments = useCallback(
    async (authenticated: boolean) => {
      if (!projectId) return;
      // Invite guests (even if signed in) need the public+invite ACL.
      const useAuthenticatedList =
        authenticated && !inviteToken?.trim();
      const list = useAuthenticatedList
        ? await fetchProjectDocuments(projectId)
        : await fetchPublicProjectDocuments(projectId, {
            inviteToken,
          });
      setDocuments(list.filter((d) => d.status === 'uploaded'));
    },
    [projectId, inviteToken],
  );

  const loadProjectView = useCallback(async () => {
    if (!projectId || !sessionReady) return;

    setError(null);
    setProject(null);
    setDocuments([]);
    setIsOwner(false);
    setPageReady(false);

    const profile = me;
    setAuthState(profile ? 'authenticated' : 'guest');

    const loadParticipantView = async (): Promise<boolean> => {
      if (
        !profile ||
        (!isContractorUser(profile) && !isDesignerUser(profile))
      ) {
        return false;
      }
      try {
        const participantProject =
          await fetchContractorParticipantProject(projectId);
        setProject(participantProject);
        setIsOwner(false);
        await loadDocuments(true);
        setPageReady(true);
        return true;
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'NOT_FOUND') {
          return false;
        }
        throw err;
      }
    };

    try {
      if (profile) {
        try {
          const data = await fetchProject(projectId);
          setProject(data);
          setIsOwner(true);
          await loadDocuments(true);
          setPageReady(true);
          return;
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            err.message !== 'FORBIDDEN' &&
            err.message !== 'NOT_FOUND'
          ) {
            throw err;
          }
        }
      }

      // Admins open any publicly discoverable / ACL-allowed project via public API.
      if (profile && isAdminUser(profile)) {
        try {
          const data = await fetchPublicProject(projectId, { inviteToken });
          setProject(data);
          setIsOwner(false);
          await loadDocuments(true);
          setPageReady(true);
          return;
        } catch (adminErr: unknown) {
          if (
            !(adminErr instanceof Error && adminErr.message === 'NOT_FOUND')
          ) {
            throw adminErr;
          }
        }
      }

      if (await loadParticipantView()) {
        return;
      }

      try {
        const data = await fetchPublicProject(projectId, { inviteToken });
        setProject(data);
        setIsOwner(false);
        await loadDocuments(Boolean(profile));
        setPageReady(true);
      } catch (publicErr: unknown) {
        if (await loadParticipantView()) {
          return;
        }
        throw publicErr;
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        if (!profile) {
          setError(
            inviteToken
              ? t('projectDetail.inviteAccessDenied')
              : t('projectDetail.accessDeniedContractor'),
          );
        } else if (isContractorUser(profile) || isDesignerUser(profile)) {
          setError(t('projectDetail.accessDeniedParties'));
        } else {
          setError(t('projectDetail.accessDenied'));
        }
      } else {
        setError(
          err instanceof Error ? err.message : t('projectDetail.loadFailed'),
        );
      }
      setPageReady(true);
    }
  }, [projectId, loadDocuments, me, sessionReady, t, inviteToken]);

  useEffect(() => {
    if (!sessionReady) return;
    loadProjectView().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t('projectDetail.loadFailed'));
      setAuthState('guest');
      setPageReady(true);
    });

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      void loadProjectView().catch(() => {
        // Keep existing error/UI state if a bfcache restore refresh fails.
      });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [sessionReady, loadProjectView, t]);

  const handleLogout = async () => {
    await signOut();
    setProject(null);
    setDocuments([]);
    setAuthState('guest');
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !projectId) return;

    const contentType = guessContentType(file);
    if (!contentType) {
      setError(t('projectDetail.unsupportedFileType'));
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        t('projectDetail.fileTooLarge', {
          maxMb: MAX_UPLOAD_BYTES / (1024 * 1024),
        }),
      );
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const patched = new File([file], file.name, { type: contentType });
      await uploadProjectDocument(projectId, patched, docCategory);
      await loadDocuments(true);
      const data = await fetchProject(projectId);
      setProject(data);
      window.setTimeout(() => {
        void fetchProject(projectId).then(setProject);
      }, 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: ProjectDocument) => {
    if (!projectId) return;
    setError(null);
    try {
      const useAuthenticatedDownload =
        (isOwner || authState === 'authenticated') && !inviteToken?.trim();
      const { downloadUrl } = useAuthenticatedDownload
        ? await getDocumentDownloadUrl(projectId, doc.id)
        : await getPublicDocumentDownloadUrl(projectId, doc.id, {
            inviteToken,
          });
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      if (
        isSessionExpiredError(err) ||
        (err instanceof Error && err.message === 'AUTH_REQUIRED')
      ) {
        setLoginOpen(true);
        return;
      }
      setError(err instanceof Error ? err.message : t('common.downloadFailed'));
    }
  };

  const handleDeleteDocument = async (doc: ProjectDocument) => {
    if (!projectId || !project) return;
    const confirmed = await confirm({
      title: t('confirm.removeDocumentTitle'),
      message: t('confirm.removeDocumentMessage', { name: doc.originalName }),
      confirmLabel: t('common.remove'),
      tone: 'danger',
    });
    if (!confirmed) return;

    setError(null);
    setDeletingDocId(doc.id);
    try {
      await deleteProjectDocument(projectId, doc.id);
      await loadDocuments(true);
      const data = await fetchProject(projectId);
      setProject(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('projectDetail.deleteDocumentFailed'),
      );
    } finally {
      setDeletingDocId(null);
    }
  };

  const packages = project?.brief?.packages ?? [];
  const documentInsights = project?.brief?.ai?.documentInsights ?? [];
  const insightByDocumentId = new Map(
    documentInsights.map((insight) => [insight.documentId, insight]),
  );
  const packagesByDocumentId = new Map<string, typeof packages>();
  const orphanPackages: typeof packages = [];
  for (const pkg of packages) {
    if (pkg.sourceDocumentId) {
      const list = packagesByDocumentId.get(pkg.sourceDocumentId) ?? [];
      list.push(pkg);
      packagesByDocumentId.set(pkg.sourceDocumentId, list);
    } else {
      orphanPackages.push(pkg);
    }
  }
  const estimate = project?.estimate ?? null;
  const intakeActive = isOwner && project ? isIntakeActive(project) : false;
  const showDelete = isOwner && project ? canDeleteProject(project) : false;
  const showLifecycle =
    isOwner && project ? canManageProjectLifecycle(project) : false;
  const showDocDelete =
    isOwner && project ? canDeleteDocument(project) : false;
  const brief = project?.brief ?? null;
  const showTender =
    isOwner && project
      ? isTenderEligibleProjectStatus(project.status)
      : false;
  const showEstimateTenderDuo = Boolean(
    (isOwner && estimate) || showTender,
  );
  const showAdminInvite =
    Boolean(me && isAdminUser(me) && project) &&
    (project?.status === 'in_tender' || project?.status === 'clarification');

  const handleDelete = async () => {
    if (!projectId || !project) return;
    const confirmed = await confirm({
      title: t('confirm.deleteProjectTitle'),
      message: t('confirm.deleteProjectMessage', { title: project.title }),
      confirmLabel: t('confirm.deleteProjectLabel'),
      tone: 'danger',
    });
    if (!confirmed) return;

    setError(null);
    setDeleting(true);
    try {
      await deleteProject(projectId);
      router.push('/');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('projectDetail.deleteProjectFailed'),
      );
      setDeleting(false);
    }
  };

  return (
    <PageShell className="page-shell--project">
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main className="project-detail-main main-content">
        {authState === 'loading' || !pageReady ? (
          <section className="card">
            <p className="muted">{t('common.loading')}</p>
          </section>
        ) : null}

        {pageReady && project && (
          <div className="project-detail-layout">
            <div className="project-detail-primary">
              <ProjectHero
                project={project}
                estimateMidAmountThb={
                  isOwner ? (estimate?.totals.midAmount ?? null) : null
                }
                tags={project.tags}
                showTags={!intakeActive && project.tags.length > 0}
                tagsHint={
                  isOwner &&
                  isAmendableProjectStatus(project.status) &&
                  project.tags.length > 0
                    ? t('projectDetail.tagsRefreshHint')
                    : null
                }
                canEditCard={isOwner}
                onCardUpdated={setProject}
                includeSidebar={false}
                stageStatus={isOwner ? project.status : null}
              />

              {project.guestInviteAccess && (
                <section className="card guest-invite-notice">
                  <p>{t('projectDetail.guestInviteNotice')}</p>
                  {authState === 'guest' && (
                    <button
                      type="button"
                      className="primary"
                      onClick={() => setLoginOpen(true)}
                    >
                      {t('header.signIn')}
                    </button>
                  )}
                </section>
              )}

              <section className="card">
                <div className="doc-section-header">
                  <div className="doc-section-intro">
                    <h2 className="section-title">{t('documents.title')}</h2>
                    <p className="muted doc-hint">
                      {isOwner
                        ? t('documents.ownerHint', {
                            maxMb: MAX_UPLOAD_BYTES / (1024 * 1024),
                          })
                        : t('documents.publicHint')}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="doc-upload-row">
                      <label>
                        {t('documents.category')}
                        <select
                          value={docCategory}
                          onChange={(e) =>
                            setDocCategory(e.target.value as DocumentCategory)
                          }
                          disabled={uploading}
                        >
                          {DOCUMENT_CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {formatDocumentCategory(opt.value)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="sr-only"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.zip"
                        onChange={handleFileChange}
                        disabled={uploading}
                      />
                      <button
                        type="button"
                        className="primary"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploading
                          ? t('common.uploading')
                          : t('documents.uploadFile')}
                      </button>
                    </div>
                  )}
                </div>

                {documents.length === 0 ? (
                  <p className="muted">{t('documents.empty')}</p>
                ) : (
                  <>
                    <div className="doc-tiles-grid">
                      {documents.map((doc) => (
                        <DocumentTile
                          key={doc.id}
                          projectId={projectId}
                          document={doc}
                          publicView={authState !== 'authenticated'}
                          scopePackages={packagesByDocumentId.get(doc.id) ?? []}
                          insight={insightByDocumentId.get(doc.id)}
                          showDelete={showDocDelete}
                          deleting={deletingDocId === doc.id}
                          formatDateTime={formatDateTime}
                          onDownload={() => void handleDownload(doc)}
                          onDelete={() => void handleDeleteDocument(doc)}
                        />
                      ))}
                    </div>
                    <OrphanScopePackages packages={orphanPackages} />
                  </>
                )}
              </section>

              {intakeActive && (
                <IntakeWizard
                  project={project}
                  onUpdated={(updated) => setProject(updated)}
                />
              )}

              {showAdminInvite && (
                <section className="card admin-invite-card">
                  <h2 className="section-title">
                    {t('directory.adminInviteCardTitle')}
                  </h2>
                  <p className="muted">
                    {t('directory.adminInviteCardLead')}
                  </p>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setAdminInviteOpen(true)}
                  >
                    {t('directory.adminInviteButton')}
                  </button>
                </section>
              )}

              {isOwner && (
                <ClientAmendments
                  project={project}
                  onUpdated={(updated) => setProject(updated)}
                />
              )}

              {showEstimateTenderDuo && (
                <div className="project-detail-duo">
                  {isOwner && estimate && (
                    <section className="card estimate-card">
                      <div className="estimate-header">
                        <div className="estimate-header-main">
                          <h2 className="section-title">
                            {project.projectType === 'design'
                              ? t('estimateSection.designTitle')
                              : t('estimateSection.title')}
                          </h2>
                          <p className="estimate-range">
                            {formatThb(estimate.totals.minAmount)} –{' '}
                            {formatThb(estimate.totals.maxAmount)}
                          </p>
                          <p className="muted estimate-meta">
                            {t('estimateSection.midpoint')}{' '}
                            {formatThb(estimate.totals.midAmount)}
                          </p>
                        </div>
                        <EstimateConfidenceRing
                          confidence={estimate.confidence}
                        />
                      </div>
                      {isLowEstimateConfidence(estimate.confidence) && (
                        <aside
                          className="estimate-low-confidence-notice"
                          role="status"
                        >
                          <p className="estimate-low-confidence-notice-title">
                            {t('estimateSection.lowConfidenceTitle')}
                          </p>
                          <p className="estimate-low-confidence-notice-text">
                            {t('estimateSection.lowConfidenceHint')}
                          </p>
                          {(estimate.improvementQuestions?.length ?? 0) > 0 &&
                            (project.status === 'ready_for_estimate' ||
                              project.status === 'estimated') && (
                              <button
                                type="button"
                                className="secondary estimate-low-confidence-scroll"
                                onClick={() => {
                                  const el = document.getElementById(
                                    ESTIMATE_REFINE_SECTION_ID,
                                  );
                                  if (!el) return;
                                  el.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'start',
                                  });
                                  const details = el.querySelector('details');
                                  if (details) details.open = true;
                                }}
                              >
                                {t('estimateSection.scrollToRefineQuestions')}
                              </button>
                            )}
                        </aside>
                      )}
                      <EstimateRefinementPanel
                        project={project}
                        estimate={estimate}
                        onEstimateUpdated={(updated: BallparkEstimate) =>
                          setProject((prev) =>
                            prev ? { ...prev, estimate: updated } : prev,
                          )
                        }
                      />
                      {estimate.lines.length > 0 && (
                        <ul className="estimate-lines">
                          {estimate.lines.map((line, index) => (
                            <li
                              key={`${line.trade}-${index}`}
                              className="estimate-line"
                            >
                              <div>
                                <strong>{line.description}</strong>
                                <span className="muted estimate-line-trade">
                                  {line.trade}
                                </span>
                              </div>
                              <span className="estimate-line-amount">
                                {formatThb(line.lineMin)} –{' '}
                                {formatThb(line.lineMax)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="muted estimate-disclaimer">
                        {estimate.disclaimer}
                      </p>
                    </section>
                  )}

                  {showTender && (
                    <TenderSummaryCard
                      projectId={projectId}
                      project={project}
                      onUpdated={setProject}
                    />
                  )}
                </div>
              )}

              {isOwner && isContractProjectStatus(project.status) && (
                <ClientContractPanel
                  projectId={projectId}
                  project={project}
                  onProjectUpdated={setProject}
                />
              )}

              {!isOwner &&
                ((project.projectType === 'design' && isDesignerUser(me)) ||
                  (project.projectType !== 'design' && isContractorUser(me))) && (
                  <ContractorProjectPanel
                    projectId={projectId}
                    projectTitle={project.title}
                    projectDistrict={project.district}
                    projectDescription={project.description}
                    projectBrief={project.brief ?? null}
                    clarificationSummary={project.clarificationSummary}
                    projectType={project.projectType}
                  />
                )}

              {showDelete && (
                <section className="card danger-zone">
                  <h2 className="section-title">{t('projectDetail.deleteProjectTitle')}</h2>
                  <p className="muted">{t('projectDetail.deleteProjectHint')}</p>
                  <button
                    type="button"
                    className="danger"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                  >
                    {deleting
                      ? t('common.pleaseWait')
                      : t('projectDetail.deleteProject')}
                  </button>
                </section>
              )}
            </div>

            <aside className="project-detail-sidebar">
              <div className="project-detail-sidebar-stack">
                <ProjectHeroSidebar
                  project={project}
                  estimateMidAmountThb={
                    isOwner ? (estimate?.totals.midAmount ?? null) : null
                  }
                  tags={project.tags}
                  showTags={!intakeActive && project.tags.length > 0}
                  tagsHint={
                    isOwner &&
                    isAmendableProjectStatus(project.status) &&
                    project.tags.length > 0
                      ? t('projectDetail.tagsRefreshHint')
                      : null
                  }
                />
                {brief && <ProjectBriefCard brief={brief} compact />}
                {showLifecycle && (
                  <ProjectLifecyclePanel
                    project={project}
                    onUpdated={setProject}
                  />
                )}
              </div>
            </aside>
          </div>
        )}

        {pageReady && !project && error && (
          <section className="card error">
            <p>{error}</p>
            {authState === 'guest' && (
              <button
                type="button"
                className="primary"
                onClick={() => setLoginOpen(true)}
              >
                {t('header.signIn')}
              </button>
            )}
            <Link href="/" className="text-link">
              {t('bidsPage.backToProjects')}
            </Link>
          </section>
        )}

        {error && project && (
          <section className="card error">
            <pre>{error}</pre>
          </section>
        )}
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          void (async () => {
            await refreshSession();
            await loadProjectView();
          })();
        }}
      />
      {adminInviteOpen && project && (
        <InviteFromDirectoryModal
          projectId={project.id}
          projectType={project.projectType}
          variant="admin"
          onClose={() => setAdminInviteOpen(false)}
        />
      )}
      {confirmDialog}
    </PageShell>
  );
}
