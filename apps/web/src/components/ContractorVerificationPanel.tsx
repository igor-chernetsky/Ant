'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { ContractorProfile } from '@/lib/tendering';
import { formatFileSize } from '@/lib/documents';
import {
  fetchVerificationDocuments,
  getVerificationDocumentDownloadUrl,
  requestContractorApproval,
  uploadVerificationDocument,
  VERIFICATION_DOC_CATEGORIES,
  type ContractorVerificationDocCategory,
  type ContractorVerificationDocument,
} from '@/lib/verification';
import { AnalyticsEvents, trackEvent } from '@/lib/analytics';

const RECOMMENDED_VERIFICATION_CATEGORIES: ContractorVerificationDocCategory[] =
  ['business_license', 'registration', 'insurance', 'owners_id'];

interface ContractorVerificationPanelProps {
  profile: ContractorProfile;
  onProfileUpdated: (profile: ContractorProfile) => void;
}

export function ContractorVerificationPanel({
  profile,
  onProfileUpdated,
}: ContractorVerificationPanelProps) {
  const { t } = useTranslation();
  const { formatVerificationStatus, formatDocumentCategory } = useAppFormatters();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
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

  const missingRecommendedCategories = useMemo(() => {
    const uploaded = new Set(documents.map((doc) => doc.category));
    return RECOMMENDED_VERIFICATION_CATEGORIES.filter(
      (category) => !uploaded.has(category),
    );
  }, [documents]);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await fetchVerificationDocuments();
      setDocuments(docs.filter((d) => d.status === 'uploaded'));
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('verification.loadDocumentsFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setError(err instanceof Error ? err.message : t('common.uploadFailed'));
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
      setError(err instanceof Error ? err.message : t('common.downloadFailed'));
    }
  };

  const handleRequestApproval = async () => {
    if (!profile.phone?.trim()) {
      setError(t('verification.phoneRequired'));
      return;
    }
    if (!profile.taxId?.trim() || !/^\d{13}$/.test(profile.taxId.trim())) {
      setError(t('verification.taxIdRequired'));
      return;
    }
    if (
      !profile.preferredContactMethods ||
      profile.preferredContactMethods.length === 0
    ) {
      setError(t('verification.contactMethodsRequired'));
      return;
    }
    if (!profile.bankName?.trim() || !profile.bankAccount?.trim()) {
      setError(t('verification.bankRequired'));
      return;
    }

    const missingList =
      missingRecommendedCategories.length > 0
        ? t('verification.requestApprovalConfirmMissing', {
            categories: missingRecommendedCategories
              .map((category) => formatDocumentCategory(category))
              .join(', '),
          })
        : '';

    const confirmed = await confirm({
      title: t('verification.requestApprovalConfirmTitle'),
      message: [
        t('verification.requestApprovalConfirmMessage', {
          count: String(documents.length),
        }),
        missingList,
      ]
        .filter(Boolean)
        .join('\n\n'),
      confirmLabel: t('verification.requestApprovalConfirmLabel'),
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const updated = (await requestContractorApproval()) as ContractorProfile;
      trackEvent(AnalyticsEvents.verificationRequest, {
        document_count: documents.length,
        profile_kind: updated.kind ?? 'contractor',
      });
      onProfileUpdated(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.requestFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card verification-card">
      <h2 className="section-title">{t('verification.title')}</h2>
      <p className="muted doc-hint">{t('verification.hint')}</p>

      <p className="verification-status-line">
        {t('verification.statusLabel')}{' '}
        <span className="status-pill status-pill-lg">
          {formatVerificationStatus(profile.verificationStatus)}
        </span>
      </p>
      <p className="muted doc-hint">
        {t('common.phone')}:{' '}
        {profile.phone?.trim() ? profile.phone : t('common.dash')}
        {!profile.phone?.trim() && canRequestApproval
          ? ` — ${t('verification.phoneRequired')}`
          : ''}
      </p>
      <p className="muted doc-hint">
        {t('contractor.taxIdLabel')}:{' '}
        {profile.taxId?.trim() ? profile.taxId : t('common.dash')}
        {(!profile.taxId?.trim() || !/^\d{13}$/.test(profile.taxId.trim())) &&
        canRequestApproval
          ? ` — ${t('verification.taxIdRequired')}`
          : ''}
      </p>
      <p className="muted doc-hint">
        {t('contractor.preferredContactLabel')}:{' '}
        {profile.preferredContactMethods?.length
          ? profile.preferredContactMethods
              .map((method) => t(`contractor.contactMethod_${method}`))
              .join(', ')
          : t('common.dash')}
        {(!profile.preferredContactMethods ||
          profile.preferredContactMethods.length === 0) &&
        canRequestApproval
          ? ` — ${t('verification.contactMethodsRequired')}`
          : ''}
      </p>
      <p className="muted doc-hint">
        {t('contractor.bankNameLabel')}:{' '}
        {profile.bankName?.trim() ? profile.bankName : t('common.dash')}
        {' · '}
        {t('contractor.bankAccountLabel')}:{' '}
        {profile.bankAccount?.trim() ? profile.bankAccount : t('common.dash')}
        {(!profile.bankName?.trim() || !profile.bankAccount?.trim()) &&
        canRequestApproval
          ? ` — ${t('verification.bankRequired')}`
          : ''}
      </p>

      {profile.verificationStatus === 'verified' && (
        <p className="muted">{t('verification.verifiedMessage')}</p>
      )}

      {profile.verificationStatus === 'awaiting_review' && (
        <p className="muted">{t('verification.awaitingReviewMessage')}</p>
      )}

      {profile.verificationComment && (
        <div className="verification-rejection">
          <strong>{t('verification.adminFeedback')}</strong>
          <p>{profile.verificationComment}</p>
        </div>
      )}

      <div className="verification-documents-section">
        <h3 className="tender-subsection-title">{t('verification.yourDocuments')}</h3>
        {loading ? (
          <p className="muted">{t('verification.loadingDocuments')}</p>
        ) : documents.length === 0 ? (
          <p className="muted">{t('verification.noDocuments')}</p>
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
                  {formatDocumentCategory(doc.category)}
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
            {t('verification.documentType')}
            <select
              value={docCategory}
              onChange={(e) =>
                setDocCategory(e.target.value as ContractorVerificationDocCategory)
              }
              disabled={busy}
            >
              {VERIFICATION_DOC_CATEGORIES.map((opt) => (
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
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx"
            onChange={handleFileChange}
            disabled={busy}
          />
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? t('common.uploading') : t('verification.uploadDocument')}
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
            {busy ? t('common.submitting') : t('verification.requestApproval')}
          </button>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      {confirmDialog}
    </section>
  );
}
