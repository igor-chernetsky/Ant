'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { ContractorProfile } from '@/lib/tendering';
import { formatFileSize } from '@/lib/documents';
import {
  fetchVerificationDocuments,
  formatVerificationStatus,
  getVerificationDocumentDownloadUrl,
  requestContractorApproval,
  uploadVerificationDocument,
  VERIFICATION_DOC_CATEGORIES,
  type ContractorVerificationDocCategory,
  type ContractorVerificationDocument,
} from '@/lib/verification';

interface ContractorVerificationPanelProps {
  profile: ContractorProfile;
  onProfileUpdated: (profile: ContractorProfile) => void;
}

export function ContractorVerificationPanel({
  profile,
  onProfileUpdated,
}: ContractorVerificationPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<ContractorVerificationDocument[]>(
    [],
  );
  const [docCategory, setDocCategory] =
    useState<ContractorVerificationDocCategory>('business_license');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUploadDocuments =
    profile.verificationStatus === 'pending' ||
    profile.verificationStatus === 'rejected' ||
    profile.verificationStatus === 'verified';

  const canRequestApproval =
    profile.verificationStatus === 'pending' ||
    profile.verificationStatus === 'rejected';

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await fetchVerificationDocuments();
      setDocuments(docs.filter((d) => d.status === 'uploaded'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      await uploadVerificationDocument(file, docCategory);
      await loadDocs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (doc: ContractorVerificationDocument) => {
    setError(null);
    try {
      const { downloadUrl } = await getVerificationDocumentDownloadUrl(doc.id);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleRequestApproval = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = (await requestContractorApproval()) as ContractorProfile;
      onProfileUpdated(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card verification-card">
      <h2 className="section-title">Verification</h2>
      <p className="muted doc-hint">
        Upload company documents (license, registration, insurance). An admin
        must approve your profile before you can participate in tenders.
      </p>

      <p className="verification-status-line">
        Status:{' '}
        <span className="status-pill status-pill-lg">
          {formatVerificationStatus(profile.verificationStatus)}
        </span>
      </p>

      {profile.verificationStatus === 'verified' && (
        <p className="muted">
          Your contractor account is verified. You can still add documents below
          for your records.
        </p>
      )}

      {profile.verificationStatus === 'awaiting_review' && (
        <p className="muted">
          Your documents are under review. You will be notified after an admin
          decision.
        </p>
      )}

      {profile.verificationComment && (
        <div className="verification-rejection">
          <strong>Admin feedback</strong>
          <p>{profile.verificationComment}</p>
        </div>
      )}

      <div className="verification-documents-section">
        <h3 className="tender-subsection-title">Your documents</h3>
        {loading ? (
          <p className="muted">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="muted">No verification documents uploaded yet.</p>
        ) : (
          <ul className="doc-list verification-doc-list">
            {documents.map((doc) => (
              <li key={doc.id} className="doc-item">
                <button
                  type="button"
                  className="doc-link"
                  onClick={() => void handleDownload(doc)}
                >
                  {doc.originalName}
                </button>
                <p className="muted doc-meta">
                  {VERIFICATION_DOC_CATEGORIES.find((c) => c.value === doc.category)
                    ?.label ?? doc.category}
                  {doc.sizeBytes != null && ` · ${formatFileSize(doc.sizeBytes)}`}
                  {doc.uploadedAt &&
                    ` · ${new Date(doc.uploadedAt).toLocaleDateString()}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canUploadDocuments && (
        <div className="doc-upload-row verification-upload-row">
          <label>
            Document type
            <select
              value={docCategory}
              onChange={(e) =>
                setDocCategory(e.target.value as ContractorVerificationDocCategory)
              }
              disabled={busy}
            >
              {VERIFICATION_DOC_CATEGORIES.map((opt) => (
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
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            onChange={handleFileChange}
            disabled={busy}
          />
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? 'Uploading…' : 'Upload document'}
          </button>
        </div>
      )}

      {canRequestApproval && (
        <div className="tender-actions">
          <button
            type="button"
            className="primary"
            disabled={busy || documents.length === 0}
            onClick={() => void handleRequestApproval()}
          >
            {busy ? 'Submitting…' : 'Request approval'}
          </button>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
