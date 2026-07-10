'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  fetchBidClarificationSubmission,
  submitBidClarificationQuestions,
} from '@/lib/tendering';

interface StructuredClarificationFormProps {
  bidId: string;
  disabled?: boolean;
  onSubmitted?: () => void;
}

export function StructuredClarificationForm({
  bidId,
  disabled = false,
  onSubmitted,
}: StructuredClarificationFormProps) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<string[]>(['']);
  const [submitted, setSubmitted] = useState<{
    questions: string[];
    submittedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchBidClarificationSubmission(bidId);
        if (!cancelled) {
          setSubmitted(data);
          if (data) {
            setQuestions(data.questions);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t('clarification.loadQuestionsFailed'),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bidId, t]);

  const updateQuestion = (index: number, value: string) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? value : q)));
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, '']);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed) {
      setError(t('clarification.confirmReview'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await submitBidClarificationQuestions(bidId, questions);
      setSubmitted(result);
      onSubmitted?.();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('clarification.submitQuestionsFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="muted">{t('clarification.loadingForm')}</p>;
  }

  if (submitted) {
    return (
      <div className="structured-clarification structured-clarification--submitted">
        <p className="structured-clarification-disclaimer">
          {t('clarification.submittedOn', {
            date: new Date(submitted.submittedAt).toLocaleString(),
          })}
        </p>
        <p className="muted structured-clarification-waiting">
          {t('clarification.waitForAnswers')}
        </p>
        <ol className="structured-clarification-list">
          {submitted.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <form
      className="structured-clarification"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <p className="structured-clarification-disclaimer">
        {t('clarification.composeDisclaimer')}
      </p>

      <div className="structured-clarification-questions">
        {questions.map((question, index) => (
          <label key={index} className="structured-clarification-row">
            <span className="structured-clarification-index">{index + 1}.</span>
            <input
              type="text"
              value={question}
              disabled={disabled || busy}
              placeholder={t('clarification.questionPlaceholder')}
              onChange={(e) => updateQuestion(index, e.target.value)}
            />
            <button
              type="button"
              className="icon-button structured-clarification-remove"
              aria-label={t('common.removeQuestion')}
              disabled={disabled || busy || questions.length <= 1}
              onClick={() => removeQuestion(index)}
            >
              ×
            </button>
          </label>
        ))}
      </div>

      <div className="structured-clarification-toolbar">
        <button
          type="button"
          className="secondary"
          disabled={disabled || busy || questions.length >= 30}
          onClick={addQuestion}
        >
          {t('clarification.addQuestion')}
        </button>
      </div>

      <label className="structured-clarification-confirm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled || busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {t('clarification.confirmCheckbox')}
      </label>

      <button
        type="submit"
        className="primary"
        disabled={disabled || busy}
      >
        {busy ? t('common.submitting') : t('clarification.submitQuestionList')}
      </button>

      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
