'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  answerClarificationQuestion,
  fetchClarificationQuestions,
  type ClarificationQuestion,
} from '@/lib/tendering';

interface ClientClarificationQuestionsPanelProps {
  projectId: string;
  clarificationSummary?: string | null;
  onUpdated?: () => void;
}

export function ClientClarificationQuestionsPanel({
  projectId,
  clarificationSummary,
  onUpdated,
}: ClientClarificationQuestionsPanelProps) {
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClarificationQuestions(projectId);
      setQuestions(data);
      setDrafts(
        Object.fromEntries(
          data.map((q) => [q.id, q.answer ?? '']),
        ),
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load questions',
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const handleSave = async (questionId: string) => {
    const answer = drafts[questionId]?.trim();
    if (!answer) {
      setError('Answer cannot be empty');
      return;
    }

    setSavingId(questionId);
    setError(null);
    try {
      const updated = await answerClarificationQuestion(
        projectId,
        questionId,
        answer,
      );
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? updated : q)),
      );
      onUpdated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save answer');
    } finally {
      setSavingId(null);
    }
  };

  const answeredCount = questions.filter((q) => q.answer?.trim()).length;

  if (loading) {
    return (
      <div className="client-clarification-panel">
        <p className="muted">Loading contractor questions…</p>
      </div>
    );
  }

  return (
    <div className="client-clarification-panel">
      <h3 className="tender-subsection-title">Contractor clarification questions</h3>
      <p className="muted client-clarification-hint">
        Questions from all contractors are merged into one list (duplicates
        removed when they ask the same thing). Answer any items you can — you do
        not need to answer every question. When you open the tender, answered
        items are summarized for contractors and commercial proposals.
      </p>

      {questions.length === 0 ? (
        <p className="muted">
          No questions yet. Contractors will submit their lists during
          clarification.
        </p>
      ) : (
        <>
          <p className="muted client-clarification-progress">
            {answeredCount} of {questions.length} answered
          </p>
          <ul className="client-clarification-list">
            {questions.map((question, index) => {
              const isAnswered = Boolean(question.answer?.trim());
              const draft = drafts[question.id] ?? '';
              const isDirty = draft.trim() !== (question.answer ?? '').trim();

              return (
                <li
                  key={question.id}
                  className={`client-clarification-item${isAnswered ? ' client-clarification-item--answered' : ''}`}
                >
                  <p className="client-clarification-question">
                    <span className="client-clarification-index">
                      {index + 1}.
                    </span>{' '}
                    {question.questionText}
                  </p>
                  <label>
                    Your answer
                    <textarea
                      rows={3}
                      value={draft}
                      disabled={savingId === question.id}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [question.id]: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="client-clarification-actions">
                    <button
                      type="button"
                      className="primary"
                      disabled={
                        savingId === question.id || !draft.trim() || !isDirty
                      }
                      onClick={() => void handleSave(question.id)}
                    >
                      {savingId === question.id ? 'Saving…' : 'Save answer'}
                    </button>
                    {isAnswered && !isDirty && (
                      <span className="muted client-clarification-saved">
                        Saved{' '}
                        {question.answeredAt
                          ? new Date(question.answeredAt).toLocaleString()
                          : ''}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {clarificationSummary && (
        <div className="client-clarification-summary">
          <h4 className="tender-subsection-title">Clarification summary</h4>
          <p>{clarificationSummary}</p>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
