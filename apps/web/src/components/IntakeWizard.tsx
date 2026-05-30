'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Project } from '@/lib/projects';
import {
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
  const question = intake?.currentQuestion;
  const [textValue, setTextValue] = useState('');
  const [singleValue, setSingleValue] = useState('');
  const [multiValues, setMultiValues] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTextValue('');
    setSingleValue('');
    setMultiValues([]);
    setError(null);
  }, [question?.id]);

  if (!intake || intake.status === 'completed') {
    return null;
  }

  const answeredCount = intake.answers.length;
  const showSubmit =
    intake.status === 'ready_to_submit' && !question;

  const handleSubmitAnswer = async (event: FormEvent) => {
    event.preventDefault();
    if (!question) return;

    setError(null);
    setSubmitting(true);
    try {
      let value: string | string[] | undefined;
      if (question.type === 'info') {
        value = '';
      } else if (question.type === 'text') {
        value = textValue;
      } else if (question.type === 'single') {
        value = singleValue;
      } else {
        value = multiValues;
      }

      const updated = await submitIntakeAnswer(project.id, {
        questionId: question.id,
        value,
      });
      onUpdated(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
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
        contractors receive an accurate scope.
      </p>

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
          <p className="intake-progress muted">
            Question {answeredCount + 1}
          </p>
          <QuestionFields
            question={question}
            textValue={textValue}
            singleValue={singleValue}
            multiValues={multiValues}
            onTextChange={setTextValue}
            onSingleChange={setSingleValue}
            onToggleMulti={toggleMulti}
          />
          <button
            type="submit"
            className="primary"
            disabled={submitting}
          >
            {submitting
              ? 'Saving…'
              : question.type === 'info'
                ? 'Continue'
                : 'Next'}
          </button>
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

function QuestionFields({
  question,
  textValue,
  singleValue,
  multiValues,
  onTextChange,
  onSingleChange,
  onToggleMulti,
}: {
  question: IntakeQuestion;
  textValue: string;
  singleValue: string;
  multiValues: string[];
  onTextChange: (v: string) => void;
  onSingleChange: (v: string) => void;
  onToggleMulti: (id: string) => void;
}) {
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
          required={question.required}
        />
      )}

      {question.type === 'single' &&
        question.options?.map((option) => (
          <label key={option.id} className="intake-option">
            <input
              type="radio"
              name={`q-${question.id}`}
              value={option.id}
              checked={singleValue === option.id}
              onChange={() => onSingleChange(option.id)}
              required={question.required}
            />
            {option.label}
          </label>
        ))}

      {question.type === 'multi' &&
        question.options?.map((option) => (
          <label key={option.id} className="intake-option">
            <input
              type="checkbox"
              checked={multiValues.includes(option.id)}
              onChange={() => onToggleMulti(option.id)}
            />
            {option.label}
          </label>
        ))}
    </fieldset>
  );
}
