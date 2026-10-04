'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import type { ProjectCompletionContext } from '@/lib/project-reviews';
import {
  fetchProject,
  hideProject,
  unhideProject,
  type Project,
} from '@/lib/projects';
import { AnalyticsEvents, trackEvent } from '@/lib/analytics';

interface ProjectLifecyclePanelProps {
  project: Project;
  onUpdated: (project: Project) => void;
  /**
   * Completion state loaded by the project page. The page owns this fetch so the
   * hero header, the top banner and this card can never disagree about whether
   * the client may confirm completion — or which modal is open.
   */
  completion: ProjectCompletionContext | null;
  completionLoading?: boolean;
  /** Opens the shared completion review modal in request mode. */
  onRequestCompletion: () => void;
  /** Opens the shared completion review modal in confirm mode. */
  onConfirmCompletion: () => void;
}

export function ProjectLifecyclePanel({
  project,
  onUpdated,
  completion,
  completionLoading = false,
  onRequestCompletion,
  onConfirmCompletion,
}: ProjectLifecyclePanelProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProject = async () => {
    onUpdated(await fetchProject(project.id));
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
              trackEvent(AnalyticsEvents.unhideProject, {
                project_id: project.id,
                status: updated.status,
              });
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
                trackEvent(AnalyticsEvents.hideProject, {
                  project_id: project.id,
                  status: updated.status,
                });
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
            onClick={onRequestCompletion}
          >
            {t('lifecycle.requestCompletion')}
          </button>
        )}

        {canConfirmCompletion && !isCompleted && (
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={onConfirmCompletion}
          >
            {t('lifecycle.confirmCompletion')}
          </button>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
