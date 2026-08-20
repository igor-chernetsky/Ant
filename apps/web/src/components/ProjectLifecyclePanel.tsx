'use client';

import { useCallback, useEffect, useState } from 'react';
import { CompleteProjectReviewModal } from '@/components/CompleteProjectReviewModal';
import { useTranslation } from '@/components/LocaleProvider';
import {
  confirmProjectCompletion,
  fetchProjectCompletionContext,
  type ProjectCompletionContext,
} from '@/lib/project-reviews';
import {
  fetchProject,
  hideProject,
  unhideProject,
  type Project,
} from '@/lib/projects';

interface ProjectLifecyclePanelProps {
  project: Project;
  onUpdated: (project: Project) => void;
}

export function ProjectLifecyclePanel({
  project,
  onUpdated,
}: ProjectLifecyclePanelProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completion, setCompletion] = useState<ProjectCompletionContext | null>(
    null,
  );
  const [completionLoading, setCompletionLoading] = useState(false);

  const loadCompletion = useCallback(async () => {
    if (project.status !== 'active' && project.status !== 'completed') {
      setCompletion(null);
      return;
    }
    setCompletionLoading(true);
    try {
      const context = await fetchProjectCompletionContext(project.id);
      setCompletion(context);
    } catch {
      setCompletion(null);
    } finally {
      setCompletionLoading(false);
    }
  }, [project.id, project.status]);

  useEffect(() => {
    void loadCompletion();
  }, [loadCompletion]);

  const refreshProject = async () => {
    const updated = await fetchProject(project.id);
    onUpdated(updated);
    await loadCompletion();
  };

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refreshProject();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('lifecycle.actionFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const isCompleted = project.status === 'completed';
  const isHidden = project.isHidden;
  const contractFullySigned = completion?.contractFullySigned ?? project.status === 'active';
  const canHide = !isCompleted && !contractFullySigned;
  const canRequestCompletion = completion?.canRequestCompletion ?? false;
  const canConfirmCompletion = completion?.canConfirmCompletion ?? false;
  const waitingForContractor =
    completion?.completionRequestedBy === 'client' && !isCompleted;
  const waitingForClient =
    completion?.completionRequestedBy === 'contractor' && !isCompleted;

  return (
    <>
      <section className="card project-lifecycle-card">
        <h2 className="section-title">{t('lifecycle.title')}</h2>
        {completionLoading ? (
          <p className="muted">{t('common.loading')}</p>
        ) : isHidden ? (
          <p className="muted">{t('lifecycle.hiddenHint')}</p>
        ) : isCompleted ? (
          <p className="muted">{t('lifecycle.completedHint')}</p>
        ) : waitingForContractor ? (
          <p className="muted">{t('lifecycle.waitingContractorHint')}</p>
        ) : waitingForClient ? (
          <p className="muted">{t('lifecycle.confirmContractorRequestHint')}</p>
        ) : canRequestCompletion ? (
          <p className="muted">{t('lifecycle.canCompleteHint')}</p>
        ) : canHide ? (
          <p className="muted">{t('lifecycle.hideHint')}</p>
        ) : (
          <p className="muted">{t('lifecycle.signedNoHideHint')}</p>
        )}

        <div className="project-lifecycle-actions">
          {isHidden ? (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void runAction(async () => {
                const updated = await unhideProject(project.id);
                onUpdated(updated);
              })}
            >
              {busy ? t('lifecycle.restoring') : t('lifecycle.showAgain')}
            </button>
          ) : (
            canHide && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void runAction(async () => {
                  const updated = await hideProject(project.id);
                  onUpdated(updated);
                })}
              >
                {busy ? t('lifecycle.hiding') : t('lifecycle.hideProject')}
              </button>
            )
          )}

          {canRequestCompletion && !isCompleted && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => setCompleteOpen(true)}
            >
              {t('lifecycle.requestCompletion')}
            </button>
          )}

          {canConfirmCompletion && !isCompleted && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() =>
                void runAction(async () => {
                  await confirmProjectCompletion(project.id);
                })
              }
            >
              {busy
                ? t('lifecycle.confirmingCompletion')
                : t('lifecycle.confirmCompletion')}
            </button>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}
      </section>

      <CompleteProjectReviewModal
        projectId={project.id}
        isOpen={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onCompleted={(updated) => {
          onUpdated(updated);
          void loadCompletion();
        }}
      />
    </>
  );
}
