'use client';

import { useTranslation } from '@/components/LocaleProvider';

interface EstimateQuestionsPreviewProps {
  /** Improvement questions returned with the estimate. */
  questions: string[];
}

/**
 * Read-only view of the questions that would sharpen the ballpark.
 *
 * Answering them is an owner action — it spends AI budget and recalculates the
 * estimate — so a guest only sees the questions, with a note that answering
 * happens after registration. The questions themselves cost nothing and tell the
 * visitor exactly what the estimate is still missing, which is the point of
 * showing the ballpark before registering at all.
 */
export function EstimateQuestionsPreview({
  questions,
}: EstimateQuestionsPreviewProps) {
  const { t } = useTranslation();

  if (questions.length === 0) {
    return null;
  }

  return (
    <section
      className="estimate-refinement estimate-questions-preview"
      aria-labelledby="estimate-questions-preview-title"
    >
      <h3
        id="estimate-questions-preview-title"
        className="estimate-questions-preview-title"
      >
        {t('estimateSection.questionsPreviewTitle')}
      </h3>
      <p className="muted estimate-questions-preview-hint">
        {t('estimateSection.questionsPreviewHint')}
      </p>
      <ul className="estimate-questions-preview-list">
        {questions.map((question, index) => (
          <li key={`${index}-${question}`}>{question}</li>
        ))}
      </ul>
    </section>
  );
}
