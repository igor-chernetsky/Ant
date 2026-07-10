'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  ClarificationAnswerAttachments,
  type ClarificationAnswerAttachmentsHandle,
} from '@/components/ClarificationAnswerAttachments';
import {
  answerClarificationQuestion,
  fetchClarificationQuestions,
  isClarificationAnsweringPhase,
  type ClarificationQuestion,
} from '@/lib/tendering';
import { formatDateTime } from '@/lib/projects';

function computeContractorStats(questions: ClarificationQuestion[]) {
  const bidIds = new Set<string>();
  for (const question of questions) {
    for (const bidId of question.sourceBidIds) {
      bidIds.add(bidId);
    }
  }

  let fullyAnsweredContractorCount = 0;
  for (const bidId of bidIds) {
    const relevant = questions.filter((question) =>
      question.sourceBidIds.includes(bidId),
    );
    if (
      relevant.length > 0 &&
      relevant.every((question) => question.answer?.trim())
    ) {
      fullyAnsweredContractorCount += 1;
    }
  }

  return {
    fullyAnsweredContractorCount,
    totalContractorCount: bidIds.size,
  };
}

interface ClientClarificationQuestionsPanelProps {
  projectId: string;
  clarificationSummary?: string | null;
  tenderStatus?: string | null;
  onUpdated?: () => void;
}

function firstUnansweredIndex(items: ClarificationQuestion[]): number {
  const index = items.findIndex((q) => !q.answer?.trim());
  return index >= 0 ? index : 0;
}

function ClarificationQuestionsSummary({
  projectId,
  questions,
  clarificationSummary,
}: {
  projectId: string;
  questions: ClarificationQuestion[];
  clarificationSummary?: string | null;
}) {
  const { t } = useTranslation();
  const answeredCount = questions.filter((q) => q.answer?.trim()).length;

  return (
    <div className="client-clarification-panel client-clarification-panel--readonly">
      <h3 className="tender-subsection-title">{t('clarificationClient.qaTitle')}</h3>
      <p className="muted client-clarification-hint">
        {t('clarificationClient.readonlyHint')}
      </p>

      {clarificationSummary?.trim() && (
        <div className="client-clarification-summary">
          <h4 className="client-clarification-summary-title">{t('clarificationClient.summary')}</h4>
          <p>{clarificationSummary}</p>
        </div>
      )}

      {questions.length === 0 ? (
        <p className="muted">{t('clarificationClient.noQuestions')}</p>
      ) : (
        <>
          <p className="muted client-clarification-readonly-meta">
            {t('clarificationClient.answeredOf', {
              answered: answeredCount,
              total: questions.length,
            })}
          </p>
          <ul className="client-clarification-readonly-list">
            {questions.map((question, index) => {
              const answered = Boolean(question.answer?.trim());
              return (
                <li key={question.id}>
                  <details className="client-clarification-readonly-item">
                    <summary className="client-clarification-readonly-summary">
                      <span className="client-clarification-readonly-question">
                        <span className="client-clarification-index">
                          {index + 1}.
                        </span>
                        {question.questionText}
                      </span>
                      <span
                        className={`client-clarification-readonly-status${
                          answered
                            ? ' client-clarification-readonly-status--answered'
                            : ''
                        }`}
                      >
                        {answered ? t('clarificationClient.answered') : t('clarificationClient.noAnswer')}
                      </span>
                    </summary>
                    <div className="client-clarification-readonly-body">
                      {answered ? (
                        <p className="client-clarification-readonly-answer">
                          {question.answer}
                        </p>
                      ) : (
                        <p className="muted client-clarification-readonly-answer">
                          {t('clarificationClient.noWrittenAnswer')}
                        </p>
                      )}
                      {question.answeredAt && (
                        <p className="muted client-clarification-readonly-answered-at">
                          {t('clarificationClient.answeredAt', {
                            date: formatDateTime(question.answeredAt),
                          })}
                        </p>
                      )}
                      <p className="muted client-clarification-asked-by">
                        {t('clarificationClient.askedBy')}{' '}
                        <strong>
                          {question.askedByCount ?? question.sourceBidIds.length}
                        </strong>{' '}
                        {(question.askedByCount ??
                          question.sourceBidIds.length) === 1
                          ? t('clarificationClient.contractor_one')
                          : t('clarificationClient.contractor_other')}
                      </p>
                      <ClarificationAnswerAttachments
                        projectId={projectId}
                        questionId={question.id}
                        attachments={question.attachments ?? []}
                        onChange={() => {}}
                        readOnly
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export function ClientClarificationQuestionsPanel({
  projectId,
  clarificationSummary,
  tenderStatus,
  onUpdated,
}: ClientClarificationQuestionsPanelProps) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [fullyAnsweredContractorCount, setFullyAnsweredContractorCount] =
    useState(0);
  const [totalContractorCount, setTotalContractorCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const attachmentsRef = useRef<ClarificationAnswerAttachmentsHandle>(null);
  const canAnswer = isClarificationAnsweringPhase(tenderStatus);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClarificationQuestions(projectId);
      setQuestions(data.questions);
      setFullyAnsweredContractorCount(data.fullyAnsweredContractorCount);
      setTotalContractorCount(data.totalContractorCount);
      setDrafts(
        Object.fromEntries(
          data.questions.map((q) => [q.id, q.answer ?? '']),
        ),
      );
      setActiveIndex(firstUnansweredIndex(data.questions));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('clarificationClient.loadFailed'),
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
      setError(t('clarificationClient.answerEmpty'));
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
      const stats = computeContractorStats(nextQuestions);
      setFullyAnsweredContractorCount(stats.fullyAnsweredContractorCount);
      setTotalContractorCount(stats.totalContractorCount);

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
      setError(err instanceof Error ? err.message : t('clarificationClient.saveFailed'));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="client-clarification-panel">
        <p className="muted">{t('clarificationClient.loading')}</p>
      </div>
    );
  }

  if (!canAnswer) {
    return (
      <ClarificationQuestionsSummary
        projectId={projectId}
        questions={questions}
        clarificationSummary={clarificationSummary}
      />
    );
  }

  return (
    <div className="client-clarification-panel">
      <h3 className="tender-subsection-title">{t('clarificationClient.questionsTitle')}</h3>
      <p className="muted client-clarification-hint">
        {t('clarificationClient.activeHint')}
      </p>

      {questions.length === 0 ? (
        <p className="muted">
          {t('clarificationClient.noQuestionsYet')}
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
                {t('clarificationClient.previous')}
              </button>
              <span className="client-clarification-nav-status">
                {t('clarificationClient.questionOf', {
                  current: activeIndex + 1,
                  total,
                })}
                <span className="client-clarification-nav-answered muted">
                  {t('clarificationClient.answeredCount', { count: answeredCount })}
                  {totalContractorCount > 0 && (
                    <>
                      {' '}
                      {t('clarificationClient.fullyAnsweredFor', {
                        answered: fullyAnsweredContractorCount,
                        total: totalContractorCount,
                        contractors:
                          totalContractorCount === 1
                            ? t('clarificationClient.contractor_one')
                            : t('clarificationClient.contractor_other'),
                      })}
                    </>
                  )}
                </span>
              </span>
              <button
                type="button"
                className="secondary client-clarification-nav-btn"
                disabled={activeIndex >= total - 1}
                onClick={() => goToQuestion(activeIndex + 1)}
              >
                {t('clarificationClient.next')}
              </button>
            </div>

            <div className="client-clarification-question">
              <span className="client-clarification-index">
                {activeIndex + 1}.
              </span>
              <div className="client-clarification-question-body">
                <p>{question.questionText}</p>
                <p className="muted client-clarification-asked-by">
                  {t('clarificationClient.askedBy')}{' '}
                  <strong>
                    {question.askedByCount ?? question.sourceBidIds.length}
                  </strong>{' '}
                  {(question.askedByCount ?? question.sourceBidIds.length) === 1
                    ? t('clarificationClient.contractor_one')
                    : t('clarificationClient.contractor_other')}
                </p>
              </div>
            </div>

            <div className="client-clarification-answer-field">
              <label
                className="client-clarification-answer-label"
                htmlFor={`clarification-answer-${question.id}`}
              >
                {t('clarificationClient.yourAnswer')}
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
                    {savingId === question.id ? t('common.saving') : t('clarificationClient.saveAnswer')}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={savingId === question.id || attachBusy}
                    onClick={() => attachmentsRef.current?.openFilePicker()}
                  >
                    {attachBusy ? t('clarificationClient.uploading') : t('common.addFiles')}
                  </button>
                  {isAnswered && !isDirty && (
                    <span className="muted client-clarification-saved">
                      {t('common.saved')}{' '}
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

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
