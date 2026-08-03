'use client';

import { useTranslation } from '@/components/LocaleProvider';
import { formatConfidence } from '@/lib/estimate';

interface EstimateConfidenceRingProps {
  confidence: number;
  size?: number;
  showCaption?: boolean;
}

export function EstimateConfidenceRing({
  confidence,
  size = 88,
  showCaption = true,
}: EstimateConfidenceRingProps) {
  const { t } = useTranslation();
  const clamped = Math.min(1, Math.max(0, confidence));
  const percent = Math.round(clamped * 100);
  const stroke = size < 64 ? 6 : 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <div
      className={`estimate-confidence-ring${showCaption ? '' : ' estimate-confidence-ring--compact'}`}
      role="img"
      aria-label={`${t('estimateSection.confidence')} ${formatConfidence(clamped)}`}
      style={{ width: size, height: size }}
    >
      <svg
        className="estimate-confidence-ring-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <circle
          className="estimate-confidence-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="estimate-confidence-ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="estimate-confidence-ring-label">
        <span className="estimate-confidence-ring-value">{percent}%</span>
        {showCaption ? (
          <span className="estimate-confidence-ring-caption">
            {t('estimateSection.confidence')}
          </span>
        ) : null}
      </div>
    </div>
  );
}
