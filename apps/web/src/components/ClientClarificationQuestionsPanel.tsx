'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClarificationAnswerAttachments,
  type ClarificationAnswerAttachmentsHandle,
} from '@/components/ClarificationAnswerAttachments';
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

function firstUnansweredIndex(items: ClarificationQuestion[]): number {
  const index = items.findIndex((q) => !q.answer?.trim());
  return index >= 0 ? index : 0;
}

export function ClientClarificationQuestionsPanel({
  projectId,
  clarificationSummary,
  onUpdated,
}: ClientClarificationQuestionsPanelProps) {
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const attachmentsRef = useRef<ClarificationAnswerAttachmentsHandle>(null);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClarificationQuestions(projectId);
      setQuestions(data);
      setDrafts(
        Object.fromEntries(data.map((q) => [q.id, q.answer ?? ''])),
      );
      setActiveIndex(firstUnansweredIndex(data));
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

  const answeredCount = questions.filter((q) => q.answer?.trim()).length;
  const question = questions[activeIndex];
  const total = questions.length;

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= total) {
      return;
    }
    setActiveIndex(index);
    setError(null);
  };

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
      const nextQuestions = questions.map((q) =>
        q.id === questionId ? updated : q,
      );
      setQuestions(nextQuestions);

      const savedIndex = nextQuestions.findIndex((q) => q.id === questionId);
      const nextUnanswered = nextQuestions.findIndex(
        (q, index) => index > savedIndex && !q.answer?.trim(),
      );
      if (nextUnanswered >= 0) {
        setActiveIndex(nextUnanswered);
      } else {
        const firstUnanswered = nextQuestions.findIndex(
          (q) => !q.answer?.trim(),
        );
        if (firstUnanswered >= 0 && firstUnanswered !== savedIndex) {
          setActiveIndex(firstUnanswered);
        }
      }

      onUpdated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save answer');
    } finally {
      setSavingId(null);
    }
  };

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
        removed when they ask the same thing). Answer one question at a time —
        you do not need to answer every question. When you open the tender,
        answered items and file lists are summarized for contractors.
      </p>

      {questions.length === 0 ? (
        <p className="muted">
          No questions yet. Contractors will submit their lists during
          clarification.
        </p>
      ) : (
        question && (
          <div
            className={`client-clarification-item${
              question.answer?.trim()
                ? ' client-clarification-item--answered'
                : ''
            }`}
          >
            <div className="client-clarification-nav">
              <button
                type="button"
                className="secondary client-clarification-nav-btn"
                disabled={activeIndex === 0}
                onClick={() => goToQuestion(activeIndex - 1)}
              >
                Previous
              </button>
              <span className="client-clarification-nav-status">
                Question {activeIndex + 1} of {total}
                <span className="client-clarification-nav-answered muted">
                  · {answeredCount} answered
                </span>
              </span>
              <button
                type="button"
                className="secondary client-clarification-nav-btn"
                disabled={activeIndex >= total - 1}
                onClick={() => goToQuestion(activeIndex + 1)}
              >
                Next
              </button>
            </div>

            <div className="client-clarification-question">
              <span className="client-clarification-index">
                {activeIndex + 1}.
              </span>
              <p>{question.questionText}</p>
            </div>

            <div className="client-clarification-answer-field">
              <label
                className="client-clarification-answer-label"
                htmlFor={`clarification-answer-${question.id}`}
              >
                Your answer
              </label>
              <textarea
                id={`clarification-answer-${question.id}`}
                rows={3}
                value={drafts[question.id] ?? ''}
                disabled={savingId === question.id || attachBusy}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [question.id]: e.target.value,
                  }))
                }
              />
            </div>

            <ClarificationAnswerAttachments
              ref={attachmentsRef}
              projectId={projectId}
              questionId={question.id}
              attachments={question.attachments ?? []}
              disabled={savingId === question.id}
              hideAddButton
              onBusyChange={setAttachBusy}
              onChange={(attachments) =>
                setQuestions((prev) =>
                  prev.map((q) =>
                    q.id === question.id ? { ...q, attachments } : q,
                  ),
                )
              }
            />

            {(() => {
              const draft = drafts[question.id] ?? '';
              const isAnswered = Boolean(question.answer?.trim());
              const isDirty =
                draft.trim() !== (question.answer ?? '').trim();

              return (
                <div className="client-clarification-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={
                      savingId === question.id ||
                      attachBusy ||
                      !draft.trim() ||
                      !isDirty
                    }
                    onClick={() => void handleSave(question.id)}
                  >
                    {savingId === question.id ? 'Saving…' : 'Save answer'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={savingId === question.id || attachBusy}
                    onClick={() => attachmentsRef.current?.openFilePicker()}
                  >
                    {attachBusy ? 'Uploading…' : 'Add files'}
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
              );
            })()}
          </div>
        )
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
