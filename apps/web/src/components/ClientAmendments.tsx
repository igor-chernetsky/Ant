'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { Project } from '@/lib/projects';
import { formatDateTime } from '@/lib/projects';
import {
  AMENDMENT_CHANGE_TYPE_OPTIONS,
  createProjectAmendment,
  fetchProjectAmendments,
  formatChangeType,
  isAmendableProjectStatus,
  processPendingAmendments,
  type AmendmentChangeType,
  type ProjectAmendment,
} from '@/lib/amendments';

interface ClientAmendmentsProps {
  project: Project;
  onUpdated: (project: Project) => void;
}

export function ClientAmendments({ project, onUpdated }: ClientAmendmentsProps) {
  const amendable = isAmendableProjectStatus(project.status);
  const [amendments, setAmendments] = useState<ProjectAmendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [changeType, setChangeType] = useState<AmendmentChangeType | ''>('');
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAmendments = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchProjectAmendments(project.id);
      setAmendments(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load amendments');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void loadAmendments();
  }, [loadAmendments]);

  const pendingCount = amendments.filter((a) => !a.processedAt).length;

  if (!amendable) {
    if (loading) {
      return null;
    }
    if (amendments.length === 0) {
      return null;
    }
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!amendable) return;

    setError(null);
    setSaving(true);
    try {
      const created = await createProjectAmendment(project.id, {
        body: body.trim(),
        ...(changeType ? { changeType } : {}),
      });
      setAmendments((prev) => [...prev, created]);
      setBody('');
      setChangeType('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save amendment');
    } finally {
      setSaving(false);
    }
  };

  const handleProcess = async () => {
    if (!amendable || pendingCount === 0) return;

    setError(null);
    setProcessing(true);
    try {
      const result = await processPendingAmendments(project.id);
      onUpdated(result.project);
      setAmendments((prev) => {
        const byId = new Map(result.amendments.map((a) => [a.id, a]));
        return prev.map((a) => byId.get(a.id) ?? a);
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to update project',
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="card amendments-card">
      <h2 className="section-title">Client amendments</h2>
      <p className="muted doc-hint">
        {amendable
          ? 'Add clarifications or scope changes before tendering starts. AI will merge them into the project brief when you update understanding.'
          : 'Scope is locked while tendering is active. Contact support if you need to reopen edits.'}
      </p>

      {!amendable && (
        <div className="amendments-locked-callout" role="status">
          <p className="amendments-locked-title">Scope locked</p>
          <p className="amendments-locked-text">
            Amendments cannot be added or processed after tendering has started.
          </p>
        </div>
      )}

      {amendable && (
        <form
          className="amendment-form modal-form"
          onSubmit={(e) => void handleCreate(e)}
        >
          <label>
            Additional requirements
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe what changed or what contractors should know…"
              rows={4}
              disabled={saving || processing}
              required
              minLength={5}
            />
          </label>
          <label>
            Change type
            <select
              value={changeType}
              onChange={(e) =>
                setChangeType(e.target.value as AmendmentChangeType | '')
              }
              disabled={saving || processing}
            >
              {AMENDMENT_CHANGE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || 'none'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="secondary amendment-submit"
            disabled={saving || processing || body.trim().length < 5}
          >
            {saving ? 'Saving…' : 'Add amendment'}
          </button>
        </form>
      )}

      {pendingCount > 0 && amendable && (
        <div className="amendment-process-row">
          <p className="muted">
            {pendingCount} pending amendment{pendingCount === 1 ? '' : 's'} not
            yet applied to the brief.
          </p>
          <button
            type="button"
            className="primary"
            disabled={processing || saving}
            onClick={() => void handleProcess()}
          >
            {processing ? 'Updating…' : 'Update project understanding'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading amendments…</p>
      ) : amendments.length === 0 ? (
        <p className="muted">No amendments recorded yet.</p>
      ) : (
        <ul className="amendment-list">
          {amendments.map((amendment) => (
            <li key={amendment.id} className="amendment-item">
              <div className="amendment-item-header">
                <span className="amendment-type-pill">
                  {formatChangeType(amendment.changeType)}
                </span>
                <span className="muted amendment-date">
                  {formatDateTime(amendment.createdAt)}
                </span>
                {amendment.processedAt ? (
                  <span className="amendment-status processed">Applied</span>
                ) : (
                  <span className="amendment-status pending">Pending</span>
                )}
              </div>
              <p className="amendment-body">{amendment.body}</p>
              {amendment.aiResult && (
                <p className="muted amendment-ai-meta">
                  AI update · {amendment.aiResult.provider} ·{' '}
                  {Math.round(amendment.aiResult.confidence * 100)}% confidence
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="form-error amendments-error">{error}</p>}
    </section>
  );
}
