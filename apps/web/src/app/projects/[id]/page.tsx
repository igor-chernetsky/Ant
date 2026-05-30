'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { DocumentImage } from '@/components/DocumentImage';
import { IntakeWizard } from '@/components/IntakeWizard';
import { SiteHeader } from '@/components/SiteHeader';
import {
  DOCUMENT_CATEGORY_OPTIONS,
  fetchProjectDocuments,
  formatFileSize,
  getDocumentDownloadUrl,
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
  formatProjectStatus,
  formatProjectType,
  formatPropertyType,
  type Project,
} from '@/lib/projects';
import {
  fetchSessionProfile,
  logoutSession,
  type MeResponse,
} from '@/lib/session';

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
  const projectId = params.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [authState, setAuthState] = useState<AuthState>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [docCategory, setDocCategory] = useState<DocumentCategory>('blueprint');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    const data = await fetchProject(projectId);
    setProject(data);
  }, [projectId]);

  const loadDocuments = useCallback(async () => {
    if (!projectId) return;
    const list = await fetchProjectDocuments(projectId);
    setDocuments(list.filter((d) => d.status === 'uploaded'));
  }, [projectId]);

  const refreshSession = useCallback(async () => {
    setError(null);
    setProject(null);
    setDocuments([]);
    const profile = await fetchSessionProfile();
    if (profile) {
      setMe(profile);
      setAuthState('authenticated');
      await Promise.all([loadProject(), loadDocuments()]);
    } else {
      setMe(null);
      setAuthState('guest');
    }
  }, [loadProject, loadDocuments]);

  useEffect(() => {
    refreshSession().catch((err: unknown) => {
      if (err instanceof Error && err.message === 'NOT_AUTHENTICATED') {
        setAuthState('guest');
        return;
      }
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        setError('Project not found or you do not have access.');
        setAuthState('authenticated');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load project');
      setAuthState('guest');
    });
  }, [refreshSession]);

  const handleLogout = async () => {
    await logoutSession();
    setMe(null);
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
      await Promise.all([loadDocuments(), loadProject()]);
      window.setTimeout(() => {
        void loadProject();
      }, 4000);
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
      const { downloadUrl } = await getDocumentDownloadUrl(projectId, doc.id);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const clientTags = project?.tags.filter((t) => t.source === 'client') ?? [];
  const aiTags = project?.tags.filter((t) => t.source === 'ai') ?? [];
  const packages = project?.brief?.packages ?? [];
  const documentInsights = project?.brief?.ai?.documentInsights ?? [];
  const estimate = project?.estimate ?? null;
  const imageDocuments = documents.filter(isImageDocument);
  const fileDocuments = documents.filter((d) => !isImageDocument(d));
  const intakeActive = project ? isIntakeActive(project) : false;
  const showDelete = project ? canDeleteProject(project) : false;

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
      router.push('/projects');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      setDeleting(false);
    }
  };

  return (
    <>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main>
        <p className="breadcrumb">
          <Link href="/projects">← Back to projects</Link>
        </p>

        {authState === 'loading' && (
          <section className="card">
            <p className="muted">Loading…</p>
          </section>
        )}

        {authState === 'guest' && (
          <section className="card cta">
            <p>Sign in to view this project.</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              Sign in
            </button>
          </section>
        )}

        {authState === 'authenticated' && project && (
          <>
            <section className="hero card">
              <div className="detail-header">
                <div>
                  <h1>{project.title}</h1>
                  {project.description && (
                    <p className="detail-description">{project.description}</p>
                  )}
                </div>
                <div className="detail-badges">
                  <span className="status-pill status-pill-lg">
                    {formatProjectStatus(project.status)}
                  </span>
                  <span className="readiness-badge readiness-badge-lg">
                    {project.readinessScore}% ready
                  </span>
                </div>
              </div>
            </section>

            <section className="card">
              <h2 className="section-title">Overview</h2>
              <dl className="meta-grid">
                <div>
                  <dt>Project type</dt>
                  <dd>{formatProjectType(project.projectType)}</dd>
                </div>
                <div>
                  <dt>Property</dt>
                  <dd>{formatPropertyType(project.propertyType)}</dd>
                </div>
                <div>
                  <dt>District</dt>
                  <dd>{project.district ?? '—'}</dd>
                </div>
                <div>
                  <dt>Region</dt>
                  <dd>{project.regionCode}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(project.createdAt)}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{formatDateTime(project.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            {intakeActive && (
              <IntakeWizard
                project={project}
                onUpdated={(updated) => setProject(updated)}
              />
            )}

            <section className="card">
              <h2 className="section-title">Documents</h2>
              <p className="muted doc-hint">
                Upload blueprints, photos, and specifications (max{' '}
                {MAX_UPLOAD_BYTES / (1024 * 1024)} MB). Files are stored in private
                object storage.
              </p>
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
                            onOpen={() => void handleDownload(doc)}
                          />
                          <figcaption className="doc-gallery-caption">
                            {doc.originalName}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  )}

                  {fileDocuments.length > 0 && (
                    <ul className="doc-list">
                      {fileDocuments.map((doc) => (
                        <li key={doc.id} className="doc-item">
                          <div>
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
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>

            {!intakeActive && project.tags.length > 0 && (
              <section className="card">
                <h2 className="section-title">Tags</h2>
                {clientTags.length > 0 && (
                  <>
                    <h3 className="tag-section-label">Selected by you</h3>
                    <div className="tag-list">
                      {clientTags.map((tag) => (
                        <span key={tag.slug} className="tag-pill tag-pill-client">
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {aiTags.length > 0 && (
                  <>
                    <h3 className="tag-section-label">Suggested by AI</h3>
                    <div className="tag-list">
                      {aiTags.map((tag) => (
                        <span key={tag.slug} className="tag-pill tag-pill-ai">
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </section>
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

            {project.brief && (
              <section className="card">
                <h2 className="section-title">Project brief</h2>
                {project.brief.summary && (
                  <p className="brief-summary">{project.brief.summary}</p>
                )}
                {project.brief.ai?.missingFields &&
                  project.brief.ai.missingFields.length > 0 && (
                    <p className="muted">
                      Missing details:{' '}
                      {project.brief.ai.missingFields.join(', ')}
                    </p>
                  )}
                {project.brief.design && (
                  <dl className="meta-grid brief-meta">
                    <div>
                      <dt>Plans available</dt>
                      <dd>{project.brief.design.hasPlans ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt>Design tender needed</dt>
                      <dd>
                        {project.brief.design.needsDesignTender ? 'Yes' : 'No'}
                      </dd>
                    </div>
                  </dl>
                )}
              </section>
            )}

            <section className="card">
              <h2 className="section-title">Next steps</h2>
              <p className="muted">
                {intakeActive
                  ? 'Complete the intake questions above, then upload plans and photos in Documents.'
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

        {authState === 'authenticated' && !project && error && (
          <section className="card error">
            <p>{error}</p>
            <Link href="/projects" className="text-link">
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
        onSuccess={refreshSession}
      />
    </>
  );
}
