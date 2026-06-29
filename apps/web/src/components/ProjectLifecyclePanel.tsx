'use client';

import { useState } from 'react';
import { CompleteProjectReviewModal } from '@/components/CompleteProjectReviewModal';
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
      setError(err instanceof Error ? err.message : 'Action failed');
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
        <h2 className="section-title">Project visibility</h2>
        {isHidden ? (
          <p className="muted">
            This project is hidden. Only you can see it on the homepage when the
            Hidden projects filter is selected.
          </p>
        ) : isCompleted ? (
          <p className="muted">
            This project is completed. It no longer appears on the public
            homepage. Participants can still find it with the Completed filter.
          </p>
        ) : canComplete ? (
          <p className="muted">
            Hide the project from discovery, or complete it when work with your
            selected contractor is finished.
          </p>
        ) : (
          <p className="muted">
            Hide the project to remove it from everyone&apos;s view. You can
            complete the project after a winning contractor is selected.
          </p>
        )}

        <div className="project-lifecycle-actions">
          {isHidden ? (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void runAction(() => unhideProject(project.id))}
            >
              {busy ? 'Restoring…' : 'Show project again'}
            </button>
          ) : (
            !isCompleted && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void runAction(() => hideProject(project.id))}
              >
                {busy ? 'Hiding…' : 'Hide project'}
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
              Complete project
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
