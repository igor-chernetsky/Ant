'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import type { Project } from '@/lib/projects';
import { fetchProject } from '@/lib/projects';
import {
  INTAKE_OTHER_OPTION_ID,
  getIntakeProgress,
  sanitizeIntakeQuestion,
  submitIntakeAnswer,
  submitIntakeForProcessing,
  type IntakeQuestion,
} from '@/lib/intake';

interface IntakeWizardProps {
  project: Project;
  onUpdated: (project: Project) => void;
  /**
   * Whether the project already has uploaded documents. The "upload documents"
   * callout is only useful while the list is empty — otherwise it is a wall of text
   * above every question.
   */
  hasDocuments?: boolean;
}

/**
 * One answered question, kept client-side.
 *
 * The server stores only the current question, so going back to an earlier answer
 * needs the question definition itself — it is sent along when the answer is edited.
 */
interface AnswerRecord {
  question: IntakeQuestion;
  value?: string | string[];
  customText?: string;
  skipped: boolean;
}

export function IntakeWizard({
  project,
  onUpdated,
  hasDocuments = false,
}: IntakeWizardProps) {
  const { t } = useTranslation();
  const intake = project.brief?.ai?.intake;
  const question = intake?.currentQuestion
    ? sanitizeIntakeQuestion(intake.currentQuestion)
    : null;
  const [textValue, setTextValue] = useState('');
  const [singleValue, setSingleValue] = useState('');
  const [multiValues, setMultiValues] = useState<string[]>([]);
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnswerRecord[]>([]);
  /** Non-null while editing an already answered question. */
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => {
    setTextValue('');
    setSingleValue('');
    setMultiValues([]);
    setCustomText('');
    setError(null);
    setEditIndex(null);
  }, [question?.id]);

  if (!intake || intake.status === 'completed') {
    return null;
  }

  const progress = getIntakeProgress(intake);
  const showSubmit = intake.status === 'ready_to_submit' && !question;
  /**
   * The final submit runs the estimate calculation, which calls the model and can
   * take a minute. A disabled button alone looked like a frozen page, so the whole
   * screen now shows the standard spinner overlay until the request settles.
   */
  const calculatingEstimate = submitting && showSubmit;

  const editing = editIndex != null ? history[editIndex] ?? null : null;
  const activeQuestion = editing ? editing.question : question;

  const canSkip = activeQuestion != null && activeQuestion.type !== 'info';
  const isChoice =
    activeQuestion != null &&
    (activeQuestion.type === 'single' || activeQuestion.type === 'multi');
  const isOtherSelected =
    singleValue === INTAKE_OTHER_OPTION_ID ||
    multiValues.includes(INTAKE_OTHER_OPTION_ID);
  /** The free-text field only appears once "Other" is picked. */
  const showOtherInput = isChoice && isOtherSelected;

  /** Value sent to the API for the current form state. */
  const buildValue = (
    target: IntakeQuestion,
    skipped: boolean,
  ): string | string[] | undefined => {
    if (target.type === 'info') return '';
    if (skipped) return undefined;
    if (target.type === 'text') return textValue;
    if (target.type === 'single') {
      return singleValue || (customText.trim() ? INTAKE_OTHER_OPTION_ID : '');
    }
    if (
      customText.trim() &&
      !multiValues.includes(INTAKE_OTHER_OPTION_ID)
    ) {
      return [...multiValues, INTAKE_OTHER_OPTION_ID];
    }
    return multiValues;
  };

  const wantsCustomText = (target: IntakeQuestion): boolean =>
    (target.type === 'single' &&
      (singleValue === INTAKE_OTHER_OPTION_ID || !!customText.trim())) ||
    (target.type === 'multi' &&
      (multiValues.includes(INTAKE_OTHER_OPTION_ID) || !!customText.trim()));

  const loadAnswerIntoState = (record: AnswerRecord) => {
    const { question: target, value, customText: custom } = record;
    setTextValue(target.type === 'text' && typeof value === 'string' ? value : '');
    setSingleValue(
      target.type === 'single' && typeof value === 'string' ? value : '',
    );
    setMultiValues(
      target.type === 'multi' && Array.isArray(value) ? value : [],
    );
    setCustomText(custom ?? '');
    setError(null);
  };

  const openEdit = (index: number) => {
    const record = history[index];
    if (!record) return;
    setEditIndex(index);
    loadAnswerIntoState(record);
  };

  const handleSubmitAnswer = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeQuestion) return;
    if (editIndex != null) {
      await saveEdit(activeQuestion);
      return;
    }
    await sendAnswer(false);
  };

  const handleSkip = async () => {
    if (!question) return;
    await sendAnswer(true);
  };

  const saveEdit = async (target: IntakeQuestion) => {
    setError(null);
    setSubmitting(true);
    try {
      const value = buildValue(target, false);
      const custom = wantsCustomText(target) ? customText.trim() : undefined;
      const updated = await submitIntakeAnswer(project.id, {
        questionId: target.id,
        // Editing a past answer: the server no longer stores its definition.
        question: target,
        value,
        customText: custom,
      });
      setHistory((current) =>
        current.map((record, index) =>
          index === editIndex
            ? { ...record, value, customText: custom, skipped: false }
            : record,
        ),
      );
      setEditIndex(null);
      onUpdated(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('intake.submitAnswerFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const sendAnswer = async (skipped: boolean) => {
    if (!question) return;

    setError(null);
    setSubmitting(true);
    try {
      const value = buildValue(question, skipped);
      const custom = wantsCustomText(question) ? customText.trim() : undefined;

      const updated = await submitIntakeAnswer(project.id, {
        questionId: question.id,
        skipped,
        value,
        customText: skipped ? undefined : custom,
      });

      if (question.type !== 'info') {
        setHistory((current) => [
          ...current,
          {
            question,
            value,
            customText: skipped ? undefined : custom,
            skipped,
          },
        ]);
      }
      onUpdated(updated);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('intake.submitAnswerFailed');
      if (message.includes('does not match the current question')) {
        try {
          const fresh = await fetchProject(project.id);
          onUpdated(fresh);
          setError(t('intake.questionChanged'));
        } catch {
          setError(message);
        }
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const updated = await submitIntakeForProcessing(project.id);
      onUpdated(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('intake.submitIntakeFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMulti = (optionId: string) => {
    setMultiValues((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    );
  };

  /** One progress line instead of "Question 1 of ~5 · 0 answered · 10%". */
  const progressLabel = progress.isComplete
    ? t('intake.progressAllAnswered')
    : progress.onQuestion
      ? t('intake.progressQuestionShort', {
          current: progress.step,
          remaining: Math.max(0, progress.estimatedTotal - progress.step),
        })
      : t('intake.progressAnsweredCount', { answered: progress.answered });

  const renderQuestionBody = (target: IntakeQuestion) => (
    <div className="intake-question">
      <h3 className="intake-question-title">{target.prompt}</h3>

      {target.type === 'info' && (
        <p className="intake-info-note muted">{t('intake.infoNote')}</p>
      )}

      {target.type === 'text' && (
        <textarea
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder={target.placeholder ?? t('intake.yourAnswer')}
          rows={3}
        />
      )}

      {target.type === 'single' && (
        <div className="intake-options">
          {(target.options ?? []).map((option) => (
            <label
              key={option.id}
              className={`intake-option-card${
                singleValue === option.id ? ' intake-option-card--selected' : ''
              }`}
            >
              <input
                type="radio"
                name={`q-${target.id}`}
                value={option.id}
                checked={singleValue === option.id}
                onChange={() => setSingleValue(option.id)}
              />
              <span className="intake-option-label">{option.label}</span>
              <span className="intake-option-check" aria-hidden>
                ✓
              </span>
            </label>
          ))}
          <label
            className={`intake-option-card${
              isOtherSelected ? ' intake-option-card--selected' : ''
            }`}
          >
            <input
              type="radio"
              name={`q-${target.id}`}
              value={INTAKE_OTHER_OPTION_ID}
              checked={singleValue === INTAKE_OTHER_OPTION_ID}
              onChange={() => setSingleValue(INTAKE_OTHER_OPTION_ID)}
            />
            <span className="intake-option-label">
              {t('intake.otherDescribe')}
            </span>
            <span className="intake-option-check" aria-hidden>
              ✓
            </span>
          </label>
        </div>
      )}

      {target.type === 'multi' && (
        <div className="intake-options">
          {(target.options ?? []).map((option) => (
            <label
              key={option.id}
              className={`intake-option-card${
                multiValues.includes(option.id)
                  ? ' intake-option-card--selected'
                  : ''
              }`}
            >
              <input
                type="checkbox"
                checked={multiValues.includes(option.id)}
                onChange={() => toggleMulti(option.id)}
              />
              <span className="intake-option-label">{option.label}</span>
              <span className="intake-option-check" aria-hidden>
                ✓
              </span>
            </label>
          ))}
          <label
            className={`intake-option-card${
              isOtherSelected ? ' intake-option-card--selected' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={multiValues.includes(INTAKE_OTHER_OPTION_ID)}
              onChange={() => toggleMulti(INTAKE_OTHER_OPTION_ID)}
            />
            <span className="intake-option-label">
              {t('intake.otherDescribe')}
            </span>
            <span className="intake-option-check" aria-hidden>
              ✓
            </span>
          </label>
        </div>
      )}

      {showOtherInput && (
        <input
          type="text"
          className="intake-custom-input"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder={t('intake.yourAnswer')}
        />
      )}
    </div>
  );

  return (
    <section className="card intake-card" id="intake">
      <h2 className="section-title">{t('intake.title')}</h2>
      <p className="muted intake-intro">{t('intake.intro')}</p>

      {!hasDocuments && (
        <div className="intake-docs-notice" role="note">
          <p className="intake-docs-notice-title">
            {t('intake.uploadDocsTitle')}
          </p>
          <p className="intake-docs-notice-text">{t('intake.uploadDocsText')}</p>
        </div>
      )}

      <div className="intake-progress-block" aria-live="polite">
        <div className="intake-progress-header">
          <span className="intake-progress-label">{progressLabel}</span>
        </div>
        <div
          className="intake-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-label={progressLabel}
        >
          <div
            className={`intake-progress-fill${progress.isComplete ? ' intake-progress-fill-complete' : ''}`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {editing && (
        <p className="intake-review-note muted">{t('intake.editingAnswer')}</p>
      )}

      {activeQuestion && (
        <form className="intake-form" onSubmit={handleSubmitAnswer}>
          {submitting && editIndex == null ? (
            <div className="intake-question-skeleton" aria-hidden>
              <span className="skeleton-field" />
              <span className="skeleton-field" />
              <span className="skeleton-field skeleton-field--short" />
            </div>
          ) : (
            renderQuestionBody(activeQuestion)
          )}

          <div className="intake-actions">
            {editIndex != null ? (
              <>
                <button
                  type="button"
                  className="ghost"
                  disabled={submitting}
                  onClick={() => setEditIndex(null)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={submitting}
                >
                  {submitting ? t('common.saving') : t('intake.saveAnswer')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="ghost intake-back"
                  disabled={submitting || history.length === 0}
                  onClick={() => openEdit(history.length - 1)}
                >
                  {t('intake.back')}
                </button>
                <div className="intake-actions-main">
                  {canSkip && (
                    <button
                      type="button"
                      className="text-link intake-skip"
                      disabled={submitting}
                      onClick={() => void handleSkip()}
                    >
                      {t('intake.skip')}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="primary"
                    disabled={submitting}
                  >
                    {submitting
                      ? t('common.saving')
                      : activeQuestion.type === 'info'
                        ? t('intake.continue')
                        : t('intake.next')}
                  </button>
                </div>
              </>
            )}
          </div>
        </form>
      )}

      {editIndex == null && history.length > 0 && (
        <details className="intake-answers">
          <summary className="intake-answers-summary">
            {t('intake.yourAnswers')}
          </summary>
          <ul className="intake-answers-list">
            {history.map((record, index) => (
              <li key={`${record.question.id}-${index}`}>
                <span className="intake-answers-prompt">
                  {record.question.prompt}
                </span>
                <span className="intake-answers-value">
                  {describeRecord(record, t)}
                </span>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => openEdit(index)}
                >
                  {t('common.edit')}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {showSubmit && (
        <div className="intake-final">
          <p className="muted">{t('intake.allAnswered')}</p>
          <button
            type="button"
            className="primary intake-final-cta"
            disabled={submitting}
            onClick={() => void handleFinalSubmit()}
          >
            {submitting
              ? t('intake.processing')
              : t('intake.submitForProcessing')}
          </button>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <LoadingOverlay
        isOpen={calculatingEstimate}
        label={t('intake.processing')}
        hint={t('intake.processingHint')}
      />
    </section>
  );
}

/** Human readable value of a recorded answer, for the "Your answers" list. */
function describeRecord(
  record: AnswerRecord,
  t: (key: string) => string,
): string {
  if (record.skipped) return t('intake.skippedAnswer');
  const { question, value, customText } = record;
  if (question.type === 'text') return String(value ?? '') || t('common.dash');
  if (question.type === 'single') {
    if (value === INTAKE_OTHER_OPTION_ID) return customText || t('common.dash');
    return (
      question.options?.find((option) => option.id === value)?.label ??
      t('common.dash')
    );
  }
  const selected = Array.isArray(value) ? value : [];
  const labels = (question.options ?? [])
    .filter((option) => selected.includes(option.id))
    .map((option) => option.label);
  if (selected.includes(INTAKE_OTHER_OPTION_ID) && customText) {
    labels.push(customText);
  }
  return labels.join(', ') || t('common.dash');
}
