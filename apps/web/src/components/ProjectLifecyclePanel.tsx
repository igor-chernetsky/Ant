'use client';

import { useState } from 'react';
import { CompleteProjectReviewModal } from '@/components/CompleteProjectReviewModal';
import { useTranslation } from '@/components/LocaleProvider';
import { canCompleteProject } from '@/lib/project-reviews';
import {
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

  const runAction = async (action: () => Promise<Project>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      onUpdated(updated);
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
  const canComplete = canCompleteProject(project);

  return (
    <>
      <section className="card project-lifecycle-card">
        <h2 className="section-title">{t('lifecycle.title')}</h2>
        {isHidden ? (
          <p className="muted">{t('lifecycle.hiddenHint')}</p>
        ) : isCompleted ? (
          <p className="muted">{t('lifecycle.completedHint')}</p>
        ) : canComplete ? (
          <p className="muted">{t('lifecycle.canCompleteHint')}</p>
        ) : (
          <p className="muted">{t('lifecycle.hideHint')}</p>
        )}

        <div className="project-lifecycle-actions">
          {isHidden ? (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void runAction(() => unhideProject(project.id))}
            >
              {busy ? t('lifecycle.restoring') : t('lifecycle.showAgain')}
            </button>
          ) : (
            !isCompleted && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void runAction(() => hideProject(project.id))}
              >
                {busy ? t('lifecycle.hiding') : t('lifecycle.hideProject')}
              </button>
            )
          )}

          {canComplete && !isCompleted && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => setCompleteOpen(true)}
            >
              {t('lifecycle.completeProject')}
            </button>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}
      </section>

      <CompleteProjectReviewModal
        projectId={project.id}
        isOpen={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onCompleted={onUpdated}
      />
    </>
  );
}
