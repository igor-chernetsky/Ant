'use client';

interface StarRatingInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function StarRatingInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: StarRatingInputProps) {
  return (
    <div className="star-rating-field">
      <span className="star-rating-label" id={`${id}-label`}>
        {label}
      </span>
      <div
        className="star-rating-control"
        role="radiogroup"
        aria-labelledby={`${id}-label`}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= value;
          return (
            <button
              key={star}
              type="button"
              className={`star-rating-star${active ? ' star-rating-star-active' : ''}`}
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              disabled={disabled}
              onClick={() => onChange(star)}
            >
              ★
            </button>
          );
        })}
      </div>
    </div>
  );
}
