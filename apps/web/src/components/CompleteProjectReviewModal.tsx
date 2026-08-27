'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/components/LocaleProvider';
import { formatFileSize } from '@/lib/documents';
import {
  REVIEW_RATING_CATEGORIES,
  confirmProjectCompletion,
  fetchProjectCompletionContext,
  uploadReviewAttachment,
  type ReviewAttachmentUpload,
  type ReviewRatings,
} from '@/lib/project-reviews';
import { closeProject, type Project } from '@/lib/projects';
import { StarRatingInput } from '@/components/StarRatingInput';
import { AnalyticsEvents, trackEvent } from '@/lib/analytics';

const EMPTY_RATINGS = (): ReviewRatings => ({
  quality: 0,
  timeline: 0,
  communication: 0,
  professionalism: 0,
  value: 0,
  siteConduct: 0,
});

interface CompleteProjectReviewModalProps {
  projectId: string;
  mode: 'request' | 'confirm';
  isOpen: boolean;
  onClose: () => void;
  onCompleted: (project: Project) => void;
}

export function CompleteProjectReviewModal({
  projectId,
  mode,
  isOpen,
  onClose,
  onCompleted,
}: CompleteProjectReviewModalProps) {
  const { t } = useTranslation();
  const [contractorName, setContractorName] = useState<string | null>(null);
  const [ratings, setRatings] = useState<ReviewRatings>(EMPTY_RATINGS);
  const [comment, setComment] = useState('');
  const [attachments, setAttachments] = useState<ReviewAttachmentUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setRatings(EMPTY_RATINGS());
    setComment('');
    setAttachments([]);
    setError(null);

    void (async () => {
      setLoading(true);
      try {
        const context = await fetchProjectCompletionContext(projectId);
        const allowed =
          mode === 'request'
            ? context.canRequestCompletion
            : context.canConfirmCompletion;
        if (!allowed) {
          throw new Error(
            context.reason ?? t('projectReview.cannotCompleteYet'),
          );
        }
        setContractorName(context.contractorName);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : t('projectReview.loadFailed'),
        );
        setContractorName(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, mode, projectId, t]);

  if (!isOpen) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const hasAnyRating = REVIEW_RATING_CATEGORIES.some(
    (category) => ratings[category.key] >= 1,
  );
  const allRated = REVIEW_RATING_CATEGORIES.every(
    (category) => ratings[category.key] >= 1,
  );
  const hasReviewDraft =
    hasAnyRating || comment.trim().length > 0 || attachments.length > 0;
  const canSubmit =
    mode === 'request' ? allRated : !hasReviewDraft || allRated;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadReviewAttachment(projectId, file);
      setAttachments((current) => [...current, uploaded]);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('projectReview.uploadFailed'),
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'request' && !allRated) {
      setError(t('projectReview.rateAllCategories'));
      return;
    }
    if (mode === 'confirm' && hasReviewDraft && !allRated) {
      setError(t('projectReview.rateAllCategories'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'request') {
        const updated = await closeProject(projectId, {
          comment: comment.trim() || undefined,
          ratings,
          attachmentIds: attachments.map((item) => item.id),
        });
        trackEvent(AnalyticsEvents.requestProjectCompletion, {
          project_id: projectId,
        });
        onCompleted(updated);
      } else {
        const updated = await confirmProjectCompletion(
          projectId,
          hasReviewDraft
            ? {
                comment: comment.trim() || undefined,
                ratings,
                attachmentIds: attachments.map((item) => item.id),
              }
            : undefined,
        );
        trackEvent(AnalyticsEvents.confirmProjectCompletion, {
          project_id: projectId,
          status: updated.status,
        });
        onCompleted(updated);
      }
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('projectReview.completeFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const busy = loading || uploading || submitting;

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-project-title"
      >
        <div className="modal-header">
          <h2 id="complete-project-title">
            {mode === 'confirm'
              ? t('projectReview.confirmTitle')
              : t('projectReview.title')}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('common.close')}
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form className="modal-form" onSubmit={(e) => void handleSubmit(e)}>
          {loading ? (
            <p className="muted">{t('common.loading')}</p>
          ) : (
            <>
              <p className="complete-project-intro">
                {mode === 'confirm'
                  ? t('projectReview.confirmIntro', {
                      name: contractorName ?? t('projectReview.theContractor'),
                    })
                  : t('projectReview.intro', {
                      name: contractorName ?? t('projectReview.theContractor'),
                    })}
              </p>

              <div className="complete-project-ratings">
                {REVIEW_RATING_CATEGORIES.map((category) => (
                  <StarRatingInput
                    key={category.key}
                    id={`rating-${category.key}`}
                    label={t(`projectReview.${category.key}`)}
                    value={ratings[category.key]}
                    disabled={busy}
                    onChange={(value) =>
                      setRatings((current) => ({
                        ...current,
                        [category.key]: value,
                      }))
                    }
                  />
                ))}
              </div>

              <label className="field complete-project-comment">
                <span>{t('projectReview.commentLabel')}</span>
                <textarea
                  rows={4}
                  value={comment}
                  disabled={busy}
                  placeholder={t('projectReview.commentPlaceholder')}
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>

              <div className="complete-project-attachments">
                <div className="complete-project-attachments-header">
                  <p className="tag-section-label">
                    {t('projectReview.attachmentsLabel')}
                  </p>
                  <label className="secondary file-input-button">
                    {uploading ? t('common.uploading') : t('projectReview.addFile')}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      disabled={busy || attachments.length >= 10}
                      hidden
                      onChange={(event) => void handleFileChange(event)}
                    />
                  </label>
                </div>
                {attachments.length > 0 && (
                  <ul className="complete-project-attachment-list">
                    {attachments.map((item) => (
                      <li key={item.id}>
                        <span>{item.originalName}</span>
                        <span className="muted">
                          {formatFileSize(item.sizeBytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="row">
            <button
              type="submit"
              className="primary"
              disabled={busy || loading || !canSubmit}
            >
              {submitting
                ? mode === 'confirm'
                  ? t('projectReview.confirmingCompletion')
                  : t('projectReview.requestingCompletion')
                : mode === 'confirm'
                  ? t('projectReview.confirmCompletion')
                  : t('projectReview.requestCompletion')}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
