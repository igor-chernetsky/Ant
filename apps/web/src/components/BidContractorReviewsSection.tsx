'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { ContractorReviewStars } from '@/components/ContractorReviewStars';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { REVIEW_RATING_CATEGORIES } from '@/lib/project-reviews';
import { formatDateTime } from '@/lib/projects';
import {
  fetchBidContractorReviewAttachmentDownload,
  fetchBidContractorReviews,
  type BidContractorReviewsView,
} from '@/lib/tendering';

interface BidContractorReviewsSectionProps {
  projectId: string;
  bidId: string;
}

export function BidContractorReviewsSection({
  projectId,
  bidId,
}: BidContractorReviewsSectionProps) {
  const { t } = useTranslation();
  const { formatProjectType } = useAppFormatters();
  const [data, setData] = useState<BidContractorReviewsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchBidContractorReviews(projectId, bidId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(
            err instanceof Error
              ? err.message
              : t('bidContractorProfile.reviewsLoadFailed'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, bidId, t]);

  async function handleDownload(
    reviewId: string,
    attachmentId: string,
  ) {
    const key = `${reviewId}:${attachmentId}`;
    setDownloadingKey(key);
    try {
      const result = await fetchBidContractorReviewAttachmentDownload(
        projectId,
        bidId,
        reviewId,
        attachmentId,
      );
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('bidContractorProfile.reviewDownloadFailed'),
      );
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <>
      <h3 className="bid-contractor-profile-heading">
        {t('bidContractorProfile.reviewsHeading')}
      </h3>

      {loading ? (
        <p className="muted">{t('bidContractorProfile.reviewsLoading')}</p>
      ) : null}

      {!loading && error && !data ? (
        <p className="form-error">{error}</p>
      ) : null}

      {!loading && data && data.summary.reviewCount === 0 ? (
        <p className="muted">{t('bidContractorProfile.reviewsEmpty')}</p>
      ) : null}

      {!loading && data && data.summary.reviewCount > 0 ? (
        <>
          <p className="contractor-reviews-summary muted">
            {t('bidContractorProfile.reviewsSummary', {
              average: String(data.summary.averageRating ?? '—'),
              count: String(data.summary.reviewCount),
              reviewsLabel:
                data.summary.reviewCount === 1
                  ? t('common.review')
                  : t('common.reviews'),
            })}
          </p>

          <ul className="contractor-reviews-list bid-contractor-reviews-list">
            {data.reviews.map((review) => (
              <li key={review.id} className="contractor-review-item">
                <div className="contractor-review-item-header">
                  <div>
                    <p className="contractor-review-project">
                      {formatProjectType(review.projectType)}
                    </p>
                    <p className="muted contractor-review-meta">
                      {review.district?.trim()
                        ? t('bidContractorProfile.reviewMetaWithDistrict', {
                            district: review.district.trim(),
                            date: formatDateTime(review.completedAt),
                          })
                        : t('bidContractorProfile.reviewMeta', {
                            date: formatDateTime(review.completedAt),
                          })}
                    </p>
                  </div>
                  <div className="contractor-review-average">
                    <ContractorReviewStars
                      value={review.averageRating}
                      ariaLabel={t('reviews.starsAria', {
                        value: review.averageRating,
                      })}
                    />
                    <span className="contractor-review-average-value">
                      {review.averageRating.toFixed(1)}
                    </span>
                  </div>
                </div>

                {review.comment ? (
                  <p className="contractor-review-comment">{review.comment}</p>
                ) : null}

                <dl className="contractor-review-ratings">
                  {REVIEW_RATING_CATEGORIES.map((category) => {
                    const score = review.ratings[category.key];
                    if (typeof score !== 'number') {
                      return null;
                    }
                    return (
                      <div
                        key={category.key}
                        className="contractor-review-rating-row"
                      >
                        <dt>{t(`projectReview.${category.key}`)}</dt>
                        <dd>
                          <ContractorReviewStars
                            value={score}
                            ariaLabel={t('reviews.starsAria', { value: score })}
                          />
                        </dd>
                      </div>
                    );
                  })}
                </dl>

                {review.attachments.length > 0 ? (
                  <ul className="contractor-portfolio-preview-grid bid-contractor-review-attachments">
                    {review.attachments.map((attachment) => {
                      const downloadKey = `${review.id}:${attachment.id}`;
                      const isImage = attachment.contentType.startsWith('image/');
                      return (
                        <li
                          key={attachment.id}
                          className="contractor-portfolio-preview-item bid-contractor-review-attachment"
                        >
                          {isImage && attachment.previewUrl ? (
                            <a
                              href={attachment.previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="contractor-portfolio-thumb-link"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={attachment.previewUrl}
                                alt={t('bidContractorProfile.reviewPhotoAlt')}
                                className="contractor-portfolio-thumb"
                                loading="lazy"
                              />
                            </a>
                          ) : (
                            <div className="bid-contractor-review-attachment-file muted">
                              {attachment.originalName}
                            </div>
                          )}
                          <button
                            type="button"
                            className="secondary bid-contractor-review-attachment-download"
                            disabled={downloadingKey === downloadKey}
                            onClick={() =>
                              void handleDownload(review.id, attachment.id)
                            }
                          >
                            {downloadingKey === downloadKey
                              ? t('common.loading')
                              : t('bidContractorProfile.download')}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {error && data ? <p className="form-error">{error}</p> : null}
    </>
  );
}
