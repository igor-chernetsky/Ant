'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { PageShell } from '@/components/PageShell';
import { DocumentImage } from '@/components/DocumentImage';
import { ClientAmendments } from '@/components/ClientAmendments';
import { isAmendableProjectStatus } from '@/lib/amendments';
import { ContractorProjectPanel } from '@/components/ContractorProjectPanel';
import { IntakeWizard } from '@/components/IntakeWizard';
import { MetaSpecGrid } from '@/components/MetaSpecGrid';
import { ProjectHero } from '@/components/ProjectHero';
import { SiteHeader } from '@/components/SiteHeader';
import { TenderSummaryCard } from '@/components/TenderSummaryCard';
import { isTenderEligibleProjectStatus } from '@/lib/tendering';
import {
  DOCUMENT_CATEGORY_OPTIONS,
  deleteProjectDocument,
  fetchProjectDocuments,
  fetchPublicProjectDocuments,
  formatFileSize,
  getDocumentDownloadUrl,
  getPublicDocumentDownloadUrl,
  MAX_UPLOAD_BYTES,
  uploadProjectDocument,
  type DocumentCategory,
  type ProjectDocument,
} from '@/lib/documents';
import { isImageDocument } from '@/lib/document-images';
import { formatConfidence, formatThb } from '@/lib/estimate';
import { isIntakeActive } from '@/lib/intake';
import {
  canDeleteProject,
  deleteProject,
  fetchProject,
  formatDateTime,
  formatProjectType,
  formatPropertyType,
  type Project,
} from '@/lib/projects';
import { useSession } from '@/components/SessionProvider';
import { isContractorUser } from '@/lib/session';
import {
  fetchPublicProject,
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
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        setError('Project not found or not available for public viewing.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      }
      setPageReady(true);
    }
  }, [projectId, loadDocuments, me, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
    loadProjectView().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load project');
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
      setError('Unsupported file type. Use PDF, images, Word, Excel, TXT, or ZIP.');
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.`);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const patched = new File([file], file.name, { type: contentType });
      await uploadProjectDocument(projectId, patched, docCategory);
      await loadDocuments(true);
      if (!project || !isIntakeActive(project)) {
        const data = await fetchProject(projectId);
        setProject(data);
        window.setTimeout(() => {
          void fetchProject(projectId).then(setProject);
        }, 4000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
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
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleDeleteDocument = async (doc: ProjectDocument) => {
    if (!projectId || !project) return;
    const confirmed = window.confirm(
      `Remove "${doc.originalName}" from this project?`,
    );
    if (!confirmed) return;

    setError(null);
    setDeletingDocId(doc.id);
    try {
      await deleteProjectDocument(projectId, doc.id);
      await loadDocuments(true);
      const data = await fetchProject(projectId);
      setProject(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  const packages = project?.brief?.packages ?? [];
  const documentInsights = project?.brief?.ai?.documentInsights ?? [];
  const estimate = project?.estimate ?? null;
  const imageDocuments = documents.filter(isImageDocument);
  const fileDocuments = documents.filter((d) => !isImageDocument(d));
  const intakeActive = isOwner && project ? isIntakeActive(project) : false;
  const showDelete = isOwner && project ? canDeleteProject(project) : false;
  const showDocDelete = showDelete;
  const brief = project?.brief ?? null;

  const overviewItems = project
    ? [
        { label: 'Project type', value: formatProjectType(project.projectType) },
        { label: 'Property', value: formatPropertyType(project.propertyType) },
        { label: 'District', value: project.district ?? '—' },
        { label: 'Region', value: project.regionCode },
        { label: 'Created', value: formatDateTime(project.createdAt) },
        { label: 'Last updated', value: formatDateTime(project.updatedAt) },
      ]
    : [];

  const briefPropertyItems = brief?.property
    ? [
        ...(brief.property.areaSqm != null
          ? [{ label: 'Floor area', value: `${brief.property.areaSqm} sqm` }]
          : []),
        ...(brief.property.floors != null
          ? [{ label: 'Floors', value: String(brief.property.floors) }]
          : []),
        ...(brief.property.rooms != null
          ? [{ label: 'Rooms', value: String(brief.property.rooms) }]
          : []),
      ]
    : [];

  const briefDesignItems = brief?.design
    ? [
        {
          label: 'Plans available',
          value: brief.design.hasPlans ? 'Yes' : 'No',
        },
        {
          label: 'Design tender needed',
          value: brief.design.needsDesignTender ? 'Yes' : 'No',
        },
      ]
    : [];

  const handleDelete = async () => {
    if (!projectId || !project) return;
    const confirmed = window.confirm(
      `Delete "${project.title}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    setDeleting(true);
    try {
      await deleteProject(projectId);
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
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
            <p className="muted">Loading…</p>
          </section>
        ) : null}

        {pageReady && project && (
          <>
            <ProjectHero
              project={project}
              estimateMidAmountThb={estimate?.totals.midAmount ?? null}
              tags={project.tags}
              showTags={!intakeActive && project.tags.length > 0}
              tagsHint={
                isOwner &&
                isAmendableProjectStatus(project.status) &&
                project.tags.length > 0
                  ? 'Tags refresh when you apply client amendments.'
                  : null
              }
            />

            <section className="card project-overview-card">
              <h2 className="section-title">Overview</h2>
              <MetaSpecGrid items={overviewItems} />
            </section>

            <section className="card">
              <h2 className="section-title">Documents</h2>
              <p className="muted doc-hint">
                {isOwner
                  ? `Upload blueprints, photos, and specifications (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB). Files are stored in private object storage.`
                  : 'Plans, photos, and specifications attached to this project.'}
              </p>
              {isOwner && (
                <div className="doc-upload-row">
                  <label>
                    Category
                    <select
                      value={docCategory}
                      onChange={(e) =>
                        setDocCategory(e.target.value as DocumentCategory)
                      }
                      disabled={uploading}
                    >
                      {DOCUMENT_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
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
                    {uploading ? 'Uploading…' : 'Upload file'}
                  </button>
                </div>
              )}

              {documents.length === 0 ? (
                <p className="muted">No documents uploaded yet.</p>
              ) : (
                <>
                  {imageDocuments.length > 0 && (
                    <div className="doc-gallery">
                      {imageDocuments.map((doc) => (
                        <figure key={doc.id} className="doc-gallery-item">
                          <DocumentImage
                            projectId={projectId}
                            document={doc}
                            variant="gallery"
                            publicView={!isOwner}
                            onOpen={() => void handleDownload(doc)}
                          />
                          <figcaption className="doc-gallery-caption">
                            {doc.originalName}
                          </figcaption>
                          {showDocDelete && (
                            <button
                              type="button"
                              className="text-link doc-remove"
                              disabled={deletingDocId === doc.id}
                              onClick={() => void handleDeleteDocument(doc)}
                            >
                              {deletingDocId === doc.id ? 'Removing…' : 'Remove'}
                            </button>
                          )}
                        </figure>
                      ))}
                    </div>
                  )}

                  {fileDocuments.length > 0 && (
                    <ul className="doc-list">
                      {fileDocuments.map((doc) => (
                        <li key={doc.id} className="doc-item">
                          <div className="doc-item-main">
                            <button
                              type="button"
                              className="doc-link"
                              onClick={() => void handleDownload(doc)}
                            >
                              {doc.originalName}
                            </button>
                            <p className="muted doc-meta">
                              {DOCUMENT_CATEGORY_OPTIONS.find(
                                (o) => o.value === doc.category,
                              )?.label ?? doc.category}
                              {' · '}
                              {formatFileSize(doc.sizeBytes)}
                              {doc.uploadedAt &&
                                ` · ${formatDateTime(doc.uploadedAt)}`}
                            </p>
                          </div>
                          {showDocDelete && (
                            <button
                              type="button"
                              className="secondary doc-remove-btn"
                              disabled={deletingDocId === doc.id}
                              onClick={() => void handleDeleteDocument(doc)}
                            >
                              {deletingDocId === doc.id ? 'Removing…' : 'Remove'}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
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

            {estimate && (
              <section className="card estimate-card">
                <h2 className="section-title">Ballpark estimate</h2>
                <p className="estimate-range">
                  {formatThb(estimate.totals.minAmount)} –{' '}
                  {formatThb(estimate.totals.maxAmount)}
                </p>
                <p className="muted estimate-meta">
                  Midpoint {formatThb(estimate.totals.midAmount)} · Confidence{' '}
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

            {!isOwner && isContractorUser(me) && (
              <ContractorProjectPanel
                projectId={projectId}
                ballparkMid={estimate?.totals.midAmount ?? null}
                projectTitle={project.title}
                projectDistrict={project.district}
              />
            )}

            {packages.length > 0 && (
              <section className="card">
                <h2 className="section-title">Scope packages</h2>
                <p className="muted">
                  Work items inferred from documents and project details.
                </p>
                <ul className="package-list">
                  {packages.map((pkg, index) => (
                    <li key={`${pkg.trade}-${index}`} className="package-item">
                      <span className="package-trade">{pkg.trade}</span>
                      <span>{pkg.description}</span>
                      {(pkg.quantity ?? pkg.areaSqm) && (
                        <span className="muted package-qty">
                          {pkg.quantity ?? pkg.areaSqm}{' '}
                          {pkg.unit ?? (pkg.areaSqm ? 'sqm' : '')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {documentInsights.length > 0 && (
              <section className="card">
                <h2 className="section-title">Document analysis</h2>
                <ul className="insight-list">
                  {documentInsights.map((insight) => (
                    <li key={insight.documentId} className="insight-item">
                      <strong>{insight.fileName}</strong>
                      <p>{insight.summary}</p>
                      <p className="muted">
                        {formatConfidence(insight.confidence)} confidence ·{' '}
                        {insight.provider}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {brief && (
              <section className="card project-brief-card">
                <h2 className="section-title">Project brief</h2>

                {brief.summary && (
                  <p className="brief-lead">{brief.summary}</p>
                )}

                {briefPropertyItems.length > 0 && (
                  <div className="brief-subsection">
                    <h3 className="brief-subsection-title">Property details</h3>
                    <MetaSpecGrid items={briefPropertyItems} />
                  </div>
                )}

                {briefDesignItems.length > 0 && (
                  <div className="brief-subsection">
                    <h3 className="brief-subsection-title">Design &amp; plans</h3>
                    <MetaSpecGrid items={briefDesignItems} className="brief-meta" />
                  </div>
                )}

                {brief.constraints && (
                  <div className="brief-subsection">
                    <h3 className="brief-subsection-title">Constraints</h3>
                    <MetaSpecGrid
                      items={[
                        {
                          label: 'Notes',
                          value: brief.constraints,
                          fullWidth: true,
                        },
                      ]}
                    />
                  </div>
                )}

                {brief.ai?.missingFields && brief.ai.missingFields.length > 0 && (
                  <div className="brief-callout">
                    <p className="brief-callout-title">Still needed for estimate</p>
                    <ul className="brief-missing-list">
                      {brief.ai.missingFields.map((field) => (
                        <li key={field}>{field.replaceAll('_', ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            <section className="card">
              <h2 className="section-title">Next steps</h2>
              <p className="muted">
                {intakeActive
                  ? 'Upload plans and photos above, then complete the intake questions below.'
                  : !isOwner
                    ? 'Interested in this scope? Contractor matching and detailed quotes will be available in a future release.'
                    : estimate
                      ? 'Review the ballpark estimate above. Contractor matching and detailed quotes will follow in a future release.'
                      : 'Submit intake to receive a ballpark cost estimate.'}
              </p>
            </section>

            {showDelete && (
              <section className="card danger-zone">
                <h2 className="section-title">Delete project</h2>
                <p className="muted">
                  Remove this project while it is still in draft or intake. Not
                  available after estimation or tendering starts.
                </p>
                <button
                  type="button"
                  className="danger"
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? 'Deleting…' : 'Delete project'}
                </button>
              </section>
            )}
          </>
        )}

        {pageReady && !project && error && (
          <section className="card error">
            <p>{error}</p>
            <Link href="/" className="text-link">
              Return to projects
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
    </PageShell>
  );
}
