'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { REVIEW_RATING_CATEGORIES } from '@/lib/project-reviews';
import { formatDateTime } from '@/lib/projects';
import {
  fetchContractorReviews,
  type ContractorReviewItem,
} from '@/lib/tendering';

function StarRatingDisplay({
  value,
  ariaLabel,
}: {
  value: number;
  ariaLabel: string;
}) {
  const rounded = Math.round(value);
  return (
    <span className="contractor-review-stars" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={
            star <= rounded
              ? 'contractor-review-star contractor-review-star-active'
              : 'contractor-review-star'
          }
          aria-hidden
        >
          ★
        </span>
      ))}
    </span>
  );
}

export function ContractorReviewsPanel() {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<ContractorReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchContractorReviews();
        setReviews(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('reviews.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const averageOverall =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, review) => sum + review.averageRating, 0) /
            reviews.length) *
            10,
        ) / 10
      : null;

  return (
    <section className="card">
      <div className="contractor-section-header">
        <h2 className="section-title">{t('reviews.title')}</h2>
        {averageOverall != null && (
          <p className="contractor-reviews-summary muted">
            {t('reviews.averageSummary', {
              average: averageOverall,
              count: reviews.length,
              reviewsLabel:
                reviews.length === 1 ? t('common.review') : t('common.reviews'),
            })}
          </p>
        )}
      </div>

      {loading && <p className="muted">{t('reviews.loading')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && reviews.length === 0 && (
        <p className="muted">{t('reviews.empty')}</p>
      )}

      {!loading && !error && reviews.length > 0 && (
        <ul className="contractor-reviews-list">
          {reviews.map((review) => (
            <li key={review.id} className="contractor-review-item">
              <div className="contractor-review-item-header">
                <div>
                  <Link
                    href={`/projects/${review.projectId}`}
                    className="contractor-review-project text-link"
                  >
                    {review.projectTitle}
                  </Link>
                  <p className="muted contractor-review-meta">
                    {review.clientName ? `${review.clientName} · ` : ''}
                    {formatDateTime(review.createdAt)}
                  </p>
                </div>
                <div className="contractor-review-average">
                  <StarRatingDisplay
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

              {review.comment && (
                <p className="contractor-review-comment">{review.comment}</p>
              )}

              <dl className="contractor-review-ratings">
                {REVIEW_RATING_CATEGORIES.map((category) => {
                  const score = review.ratings[category.key];
                  if (typeof score !== 'number') {
                    return null;
                  }
                  return (
                    <div key={category.key} className="contractor-review-rating-row">
                      <dt>{category.label}</dt>
                      <dd>
                        <StarRatingDisplay
                          value={score}
                          ariaLabel={t('reviews.starsAria', { value: score })}
                        />
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
