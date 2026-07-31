'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  refineProjectEstimate,
  type BallparkEstimate,
} from '@/lib/estimate';
import type { Project } from '@/lib/projects';

const REFINE_STATUSES = new Set(['ready_for_estimate', 'estimated']);

interface EstimateRefinementPanelProps {
  project: Project;
  estimate: BallparkEstimate;
  onEstimateUpdated: (estimate: BallparkEstimate) => void;
}

export function EstimateRefinementPanel({
  project,
  estimate,
  onEstimateUpdated,
}: EstimateRefinementPanelProps) {
  const { t } = useTranslation();
  const questions = estimate.improvementQuestions ?? [];
  const history = estimate.refinementAnswers ?? [];
  const canRefine = REFINE_STATUSES.has(project.status) && questions.length > 0;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAnswers({});
    setError(null);
  }, [estimate.id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canRefine || submitting) return;

    const payload = questions
      .map((question, questionIndex) => ({
        question,
        questionIndex,
        answer: (answers[question] ?? '').trim(),
      }))
      .filter((row) => row.answer.length > 0);

    if (payload.length === 0) {
      setError(t('estimateSection.refineNeedAnswer'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await refineProjectEstimate(project.id, payload);
      onEstimateUpdated(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('estimateSection.refineFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!canRefine && history.length === 0) {
    return null;
  }

  return (
    <div className="estimate-refinement">
      {canRefine && (
        <details className="estimate-refine-details" open>
          <summary>{t('estimateSection.refineTitle')}</summary>
          <p className="muted estimate-refine-hint">
            {t('estimateSection.refineHint')}
          </p>
          <form className="estimate-refine-form" onSubmit={handleSubmit}>
            {questions.map((question, index) => (
              <label
                key={`${estimate.id}-${index}-${question}`}
                className="estimate-refine-field"
              >
                <span>{question}</span>
                <textarea
                  rows={2}
                  value={answers[question] ?? ''}
                  disabled={submitting}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question]: event.target.value,
                    }))
                  }
                  placeholder={t('estimateSection.answerPlaceholder')}
                />
              </label>
            ))}
            {error && <p className="form-error">{error}</p>}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting
                ? t('estimateSection.refining')
                : t('estimateSection.recalculate')}
            </button>
          </form>
        </details>
      )}

      {history.length > 0 && (
        <details className="estimate-refine-history">
          <summary>{t('estimateSection.answeredTitle')}</summary>
          <ul className="estimate-refine-history-list">
            {history.map((row, index) => (
              <li key={`${row.question}-${index}`}>
                <strong>{row.question}</strong>
                <span className="muted">{row.answer}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
