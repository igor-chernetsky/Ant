'use client';

import { FormEvent, useEffect, useState } from 'react';
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
            err instanceof Error ? err.message : 'Failed to load questions',
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
  }, [bidId]);

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
      setError('Please confirm you have reviewed your question list.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await submitBidClarificationQuestions(bidId, questions);
      setSubmitted(result);
      onSubmitted?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit questions');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="muted">Loading clarification form…</p>;
  }

  if (submitted) {
    return (
      <div className="structured-clarification structured-clarification--submitted">
        <p className="structured-clarification-disclaimer">
          Your question list was submitted on{' '}
          {new Date(submitted.submittedAt).toLocaleString()} and cannot be
          changed.
        </p>
        <p className="muted structured-clarification-waiting">
          Please wait for the answers summary and the commercial proposal form
          — they will be available soon. You will receive a notification when
          the client opens the tender.
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
        Compose all questions you need answered before bidding. You can submit
        this list <strong>only once</strong> — review it carefully before
        sending. Similar questions from all contractors are merged into one
        checklist for the client.
      </p>

      <div className="structured-clarification-questions">
        {questions.map((question, index) => (
          <label key={index} className="structured-clarification-row">
            <span className="structured-clarification-index">{index + 1}.</span>
            <input
              type="text"
              value={question}
              disabled={disabled || busy}
              placeholder="e.g. Is structural work included in scope?"
              onChange={(e) => updateQuestion(index, e.target.value)}
            />
            <button
              type="button"
              className="icon-button structured-clarification-remove"
              aria-label="Remove question"
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
          Add question
        </button>
      </div>

      <label className="structured-clarification-confirm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled || busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I have reviewed my question list and understand it cannot be edited
        after submission.
      </label>

      <button
        type="submit"
        className="primary"
        disabled={disabled || busy}
      >
        {busy ? 'Submitting…' : 'Submit question list'}
      </button>

      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
