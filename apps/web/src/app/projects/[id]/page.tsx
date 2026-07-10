'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { DocumentTile, OrphanScopePackages } from '@/components/DocumentTile';
import { ClientAmendments } from '@/components/ClientAmendments';
import { isAmendableProjectStatus } from '@/lib/amendments';
import { ContractorProjectPanel } from '@/components/ContractorProjectPanel';
import { IntakeWizard } from '@/components/IntakeWizard';
import { MetaSpecGrid } from '@/components/MetaSpecGrid';
import { ProjectHero } from '@/components/ProjectHero';
import { SiteHeader } from '@/components/SiteHeader';
import { TenderSummaryCard } from '@/components/TenderSummaryCard';
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
import { formatConfidence, formatThb } from '@/lib/estimate';
import { isIntakeActive } from '@/lib/intake';
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
import { isContractorUser } from '@/lib/session';
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
  const router = useRouter();
  const { t } = useTranslation();
  const { formatDocumentCategory } = useAppFormatters();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const projectId = params.id;
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
  const [pageReady, setPageReady] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const loadDocuments = useCallback(
    async (owner: boolean) => {
      if (!projectId) return;
      const list = owner
        ? await fetchProjectDocuments(projectId)
        : await fetchPublicProjectDocuments(projectId);
      setDocuments(list.filter((d) => d.status === 'uploaded'));
    },
    [projectId],
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

      const data = await fetchPublicProject(projectId);
      setProject(data);
      setIsOwner(false);
      await loadDocuments(false);
      setPageReady(true);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.message === 'NOT_FOUND' &&
        profile &&
        isContractorUser(profile)
      ) {
        try {
          const participantProject =
            await fetchContractorParticipantProject(projectId);
          setProject(participantProject);
          setIsOwner(false);
          await loadDocuments(false);
          setPageReady(true);
          return;
        } catch (participantErr: unknown) {
          if (
            participantErr instanceof Error &&
            participantErr.message === 'NOT_FOUND'
          ) {
            setError(t('projectDetail.projectNotFound'));
          } else {
            setError(
              participantErr instanceof Error
                ? participantErr.message
                : t('projectDetail.loadFailed'),
            );
          }
          setPageReady(true);
          return;
        }
      }
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        setError(t('projectDetail.projectNotFound'));
      } else {
        setError(
          err instanceof Error ? err.message : t('projectDetail.loadFailed'),
        );
      }
      setPageReady(true);
    }
  }, [projectId, loadDocuments, me, sessionReady, t]);

  useEffect(() => {
    if (!sessionReady) return;
    loadProjectView().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t('projectDetail.loadFailed'));
      setAuthState('guest');
      setPageReady(true);
    });
  }, [sessionReady, loadProjectView]);

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
      const { downloadUrl } = isOwner
        ? await getDocumentDownloadUrl(projectId, doc.id)
        : await getPublicDocumentDownloadUrl(projectId, doc.id);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
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

  const briefPropertyItems = brief?.property
    ? [
        ...(brief.property.areaSqm != null
          ? [
              {
                label: t('brief.floorArea'),
                value: `${brief.property.areaSqm} ${t('brief.sqm')}`,
              },
            ]
          : []),
        ...(brief.property.floors != null
          ? [{ label: t('brief.floors'), value: String(brief.property.floors) }]
          : []),
        ...(brief.property.rooms != null
          ? [{ label: t('brief.rooms'), value: String(brief.property.rooms) }]
          : []),
      ]
    : [];

  const briefDesignItems = brief?.design
    ? [
        {
          label: t('brief.plansAvailable'),
          value: brief.design.hasPlans ? t('brief.yes') : t('brief.no'),
        },
        {
          label: t('brief.designTenderNeeded'),
          value: brief.design.needsDesignTender ? t('brief.yes') : t('brief.no'),
        },
      ]
    : [];

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
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main className="content-container main-content">
        {authState === 'loading' || !pageReady ? (
          <section className="card">
            <p className="muted">{t('common.loading')}</p>
          </section>
        ) : null}

        {pageReady && project && (
          <>
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
            />

            <section className="card">
              <h2 className="section-title">{t('documents.title')}</h2>
              <p className="muted doc-hint">
                {isOwner
                  ? t('documents.ownerHint', {
                      maxMb: MAX_UPLOAD_BYTES / (1024 * 1024),
                    })
                  : t('documents.publicHint')}
              </p>
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
                    {uploading ? t('common.uploading') : t('documents.uploadFile')}
                  </button>
                </div>
              )}

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
                        publicView={!isOwner}
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

            {isOwner && (
              <ClientAmendments
                project={project}
                onUpdated={(updated) => setProject(updated)}
              />
            )}

            {isOwner && estimate && (
              <section className="card estimate-card">
                <h2 className="section-title">{t('estimateSection.title')}</h2>
                <p className="estimate-range">
                  {formatThb(estimate.totals.minAmount)} –{' '}
                  {formatThb(estimate.totals.maxAmount)}
                </p>
                <p className="muted estimate-meta">
                  {t('estimateSection.midpoint')} {formatThb(estimate.totals.midAmount)} ·{' '}
                  {t('estimateSection.confidence')}{' '}
                  {formatConfidence(estimate.confidence)}
                </p>
                {estimate.lines.length > 0 && (
                  <ul className="estimate-lines">
                    {estimate.lines.map((line, index) => (
                      <li key={`${line.trade}-${index}`} className="estimate-line">
                        <div>
                          <strong>{line.description}</strong>
                          <span className="muted estimate-line-trade">
                            {line.trade}
                          </span>
                        </div>
                        <span className="estimate-line-amount">
                          {formatThb(line.lineMin)} – {formatThb(line.lineMax)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="muted estimate-disclaimer">{estimate.disclaimer}</p>
              </section>
            )}

            {isOwner && isTenderEligibleProjectStatus(project.status) && (
              <TenderSummaryCard
                projectId={projectId}
                project={project}
                onUpdated={setProject}
              />
            )}

            {isOwner && isContractProjectStatus(project.status) && (
              <ClientContractPanel
                projectId={projectId}
                project={project}
                onProjectUpdated={setProject}
              />
            )}

            {!isOwner && isContractorUser(me) && (
              <ContractorProjectPanel
                projectId={projectId}
                projectTitle={project.title}
                projectDistrict={project.district}
                projectDescription={project.description}
                projectBrief={project.brief ?? null}
                clarificationSummary={project.clarificationSummary}
              />
            )}

            {brief && (
              <section className="card project-brief-card">
                <h2 className="section-title">{t('brief.title')}</h2>

                {brief.summary && (
                  <p className="brief-lead">{brief.summary}</p>
                )}

                {briefPropertyItems.length > 0 && (
                  <div className="brief-subsection">
                    <h3 className="brief-subsection-title">
                      {t('brief.propertyDetails')}
                    </h3>
                    <MetaSpecGrid items={briefPropertyItems} />
                  </div>
                )}

                {briefDesignItems.length > 0 && (
                  <div className="brief-subsection">
                    <h3 className="brief-subsection-title">
                      {t('brief.designPlans')}
                    </h3>
                    <MetaSpecGrid items={briefDesignItems} className="brief-meta" />
                  </div>
                )}

                {brief.constraints && (
                  <div className="brief-subsection">
                    <h3 className="brief-subsection-title">
                      {t('brief.constraints')}
                    </h3>
                    <MetaSpecGrid
                      items={[
                        {
                          label: t('brief.notes'),
                          value: brief.constraints,
                          fullWidth: true,
                        },
                      ]}
                    />
                  </div>
                )}

                {brief.ai?.missingFields && brief.ai.missingFields.length > 0 && (
                  <div className="brief-callout">
                    <p className="brief-callout-title">{t('brief.stillNeeded')}</p>
                    <ul className="brief-missing-list">
                      {brief.ai.missingFields.map((field) => (
                        <li key={field}>{field.replaceAll('_', ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {showLifecycle && project && (
              <ProjectLifecyclePanel
                project={project}
                onUpdated={setProject}
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
          </>
        )}

        {pageReady && !project && error && (
          <section className="card error">
            <p>{error}</p>
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
      {confirmDialog}
    </PageShell>
  );
}
