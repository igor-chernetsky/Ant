'use client';

export function ContractorReviewStars({
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
