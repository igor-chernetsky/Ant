'use client';

import { FormEvent, useEffect, useState } from 'react';
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
}

export function IntakeWizard({ project, onUpdated }: IntakeWizardProps) {
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

  useEffect(() => {
    setTextValue('');
    setSingleValue('');
    setMultiValues([]);
    setCustomText('');
    setError(null);
  }, [question?.id]);

  if (!intake || intake.status === 'completed') {
    return null;
  }

  const progress = getIntakeProgress(intake);
  const showSubmit = intake.status === 'ready_to_submit' && !question;
  const canSkip = question != null && question.type !== 'info';
  const showCustom =
    question != null &&
    (question.type === 'single' || question.type === 'multi');
  const isOtherSelected =
    singleValue === INTAKE_OTHER_OPTION_ID ||
    multiValues.includes(INTAKE_OTHER_OPTION_ID);

  const handleSubmitAnswer = async (event: FormEvent) => {
    event.preventDefault();
    if (!question) return;
    await sendAnswer(false);
  };

  const handleSkip = async () => {
    if (!question) return;
    await sendAnswer(true);
  };

  const sendAnswer = async (skipped: boolean) => {
    if (!question) return;

    setError(null);
    setSubmitting(true);
    try {
      let value: string | string[] | undefined;
      if (question.type === 'info') {
        value = '';
      } else if (skipped) {
        value = undefined;
      } else if (question.type === 'text') {
        value = textValue;
      } else if (question.type === 'single') {
        value =
          singleValue ||
          (customText.trim() ? INTAKE_OTHER_OPTION_ID : '');
      } else {
        value = multiValues;
        if (
          customText.trim() &&
          !multiValues.includes(INTAKE_OTHER_OPTION_ID)
        ) {
          value = [...multiValues, INTAKE_OTHER_OPTION_ID];
        }
      }

      const wantsCustom =
        (question.type === 'single' &&
          (singleValue === INTAKE_OTHER_OPTION_ID || !!customText.trim())) ||
        (question.type === 'multi' &&
          (multiValues.includes(INTAKE_OTHER_OPTION_ID) || !!customText.trim()));

      const updated = await submitIntakeAnswer(project.id, {
        questionId: question.id,
        skipped,
        value,
        customText:
          !skipped && wantsCustom ? customText.trim() : undefined,
      });
      onUpdated(updated);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to submit answer';
      if (message.includes('does not match the current question')) {
        try {
          const fresh = await fetchProject(project.id);
          onUpdated(fresh);
          setError(
            'The question changed while you were answering (e.g. after uploading a file). Please try again.',
          );
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
      setError(err instanceof Error ? err.message : 'Failed to submit intake');
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

  return (
    <section className="card intake-card">
      <h2 className="section-title">Improve project description</h2>
      <p className="muted intake-intro">
        AI analyzed your project and suggested tags. Answer a few questions so
        contractors receive an accurate scope. You can skip or enter your own
        answer when needed.
      </p>

      <p className="intake-docs-notice">
        Upload all floor plans and photos in the <strong>Documents</strong>{' '}
        section above before completing intake.
      </p>

      <IntakeProgressBar progress={progress} />

      {project.brief?.ai?.improvedDescription && (
        <div className="intake-improved">
          <h3 className="intake-subtitle">AI-improved description</h3>
          <p>{project.brief.ai.improvedDescription}</p>
        </div>
      )}

      {project.tags.length > 0 && (
        <div className="intake-tags">
          <h3 className="intake-subtitle">Suggested tags</h3>
          <div className="tag-list">
            {project.tags.map((tag) => (
              <span
                key={tag.slug}
                className={`tag-pill ${tag.source === 'ai' ? 'tag-pill-ai' : 'tag-pill-client'}`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {question && (
        <form className="intake-form" onSubmit={handleSubmitAnswer}>
          <QuestionFields
            question={question}
            textValue={textValue}
            singleValue={singleValue}
            multiValues={multiValues}
            customText={customText}
            showCustom={!!showCustom}
            isOtherSelected={isOtherSelected}
            onTextChange={setTextValue}
            onSingleChange={setSingleValue}
            onToggleMulti={toggleMulti}
            onCustomTextChange={setCustomText}
          />
          <div className="intake-actions">
            {canSkip && (
              <button
                type="button"
                className="secondary"
                disabled={submitting}
                onClick={() => void handleSkip()}
              >
                Skip
              </button>
            )}
            <button type="submit" className="primary" disabled={submitting}>
              {submitting
                ? 'Saving…'
                : question.type === 'info'
                  ? 'Continue'
                  : 'Next'}
            </button>
          </div>
        </form>
      )}

      {showSubmit && (
        <div className="intake-final">
          <p className="muted">
            All questions answered. Submit to finalize the description and tags.
          </p>
          <button
            type="button"
            className="primary"
            disabled={submitting}
            onClick={() => void handleFinalSubmit()}
          >
            {submitting ? 'Processing…' : 'Submit for processing'}
          </button>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

function IntakeProgressBar({
  progress,
}: {
  progress: ReturnType<typeof getIntakeProgress>;
}) {
  return (
    <div className="intake-progress-block" aria-live="polite">
      <div className="intake-progress-header">
        <span className="intake-progress-label">{progress.label}</span>
        <span className="intake-progress-percent muted">{progress.percent}%</span>
      </div>
      <div
        className="intake-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label={progress.label}
      >
        <div
          className={`intake-progress-fill${progress.isComplete ? ' intake-progress-fill-complete' : ''}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {!progress.isComplete && (
        <p className="intake-progress-hint muted">
          {progress.answered} answered · ~{progress.estimatedTotal} questions
          expected
        </p>
      )}
    </div>
  );
}

function QuestionFields({
  question,
  textValue,
  singleValue,
  multiValues,
  customText,
  showCustom,
  isOtherSelected,
  onTextChange,
  onSingleChange,
  onToggleMulti,
  onCustomTextChange,
}: {
  question: IntakeQuestion;
  textValue: string;
  singleValue: string;
  multiValues: string[];
  customText: string;
  showCustom: boolean;
  isOtherSelected: boolean;
  onTextChange: (v: string) => void;
  onSingleChange: (v: string) => void;
  onToggleMulti: (id: string) => void;
  onCustomTextChange: (v: string) => void;
}) {
  const visibleOptions = question.options ?? [];

  return (
    <fieldset className="intake-question">
      <legend>{question.prompt}</legend>

      {question.type === 'info' && (
        <p className="intake-info-note muted">
          No answer required — continue when ready.
        </p>
      )}

      {question.type === 'text' && (
        <textarea
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={question.placeholder ?? 'Your answer…'}
          rows={3}
        />
      )}

      {question.type === 'single' && (
        <>
          {visibleOptions.map((option) => (
            <label key={option.id} className="intake-option">
              <input
                type="radio"
                name={`q-${question.id}`}
                value={option.id}
                checked={singleValue === option.id}
                onChange={() => onSingleChange(option.id)}
              />
              {option.label}
            </label>
          ))}
          {showCustom && (
            <div className="intake-other-block">
              <label className="intake-option">
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value={INTAKE_OTHER_OPTION_ID}
                  checked={singleValue === INTAKE_OTHER_OPTION_ID}
                  onChange={() => onSingleChange(INTAKE_OTHER_OPTION_ID)}
                />
                Other — describe below
              </label>
              <input
                type="text"
                className="intake-custom-input"
                value={customText}
                onChange={(e) => {
                  onCustomTextChange(e.target.value);
                  if (singleValue !== INTAKE_OTHER_OPTION_ID) {
                    onSingleChange(INTAKE_OTHER_OPTION_ID);
                  }
                }}
                placeholder="Your answer…"
              />
            </div>
          )}
        </>
      )}

      {question.type === 'multi' && (
        <>
          {visibleOptions.map((option) => (
            <label key={option.id} className="intake-option">
              <input
                type="checkbox"
                checked={multiValues.includes(option.id)}
                onChange={() => onToggleMulti(option.id)}
              />
              {option.label}
            </label>
          ))}
          {showCustom && (
            <div className="intake-other-block">
              <label className="intake-option">
                <input
                  type="checkbox"
                  checked={multiValues.includes(INTAKE_OTHER_OPTION_ID)}
                  onChange={() => onToggleMulti(INTAKE_OTHER_OPTION_ID)}
                />
                Other — describe below
              </label>
              <input
                type="text"
                className="intake-custom-input"
                value={customText}
                onChange={(e) => {
                  onCustomTextChange(e.target.value);
                  if (!multiValues.includes(INTAKE_OTHER_OPTION_ID)) {
                    onToggleMulti(INTAKE_OTHER_OPTION_ID);
                  }
                }}
                placeholder="Your answer…"
              />
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
