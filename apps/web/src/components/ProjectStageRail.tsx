'use client';

import { useTranslation } from '@/components/LocaleProvider';
import {
  PROJECT_STAGE_ANCHORS,
  PROJECT_STAGES,
  projectStageIndex,
} from '@/lib/project-stages';

const STAGES = PROJECT_STAGES;

interface ProjectStageRailProps {
  status: string;
}

const stageIndexForStatus = projectStageIndex;

export function ProjectStageRail({ status }: ProjectStageRailProps) {
  const { t } = useTranslation();

  const resolvedIndex = stageIndexForStatus(status);

  const activeStage = STAGES[resolvedIndex] ?? STAGES[0]!;

  return (
    <nav
      className="project-stage-rail"
      aria-label={t('projectStage.ariaLabel')}
    >
      <ol className="project-stage-rail-list">
        {STAGES.map((stage, index) => {
          const state =
            index < resolvedIndex
              ? 'complete'
              : index === resolvedIndex
                ? 'current'
                : 'upcoming';

          return (
            <li
              key={stage.id}
              className={`project-stage-rail-item project-stage-rail-item--${state}`}
            >
              <a
                className="project-stage-rail-link"
                href={`#${PROJECT_STAGE_ANCHORS[stage.id]}`}
                aria-current={index === resolvedIndex ? 'step' : undefined}
                onClick={(event) => {
                  const target = document.getElementById(
                    PROJECT_STAGE_ANCHORS[stage.id],
                  );
                  if (!target) {
                    // The section is not on the page yet (e.g. tender before publish).
                    event.preventDefault();
                    return;
                  }
                  event.preventDefault();
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <span className="project-stage-rail-marker" aria-hidden />
                <span className="project-stage-rail-label">
                  {t(`projectStage.${stage.id}`)}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      {/* N5: five stages wrap into two rows on a phone; one compact line instead. */}
      <p className="project-stage-compact">
        <span className="project-stage-compact-progress">
          {t('projectStage.compact', {
            current: String(resolvedIndex + 1),
            total: String(STAGES.length),
          })}
        </span>
        <span className="project-stage-compact-label">
          {t(`projectStage.${activeStage.id}`)}
        </span>
        <span className="project-stage-compact-bar" aria-hidden>
          {STAGES.map((stage, index) => (
            <span
              key={stage.id}
              className={`project-stage-compact-segment${
                index <= resolvedIndex
                  ? ' project-stage-compact-segment--done'
                  : ''
              }`}
            />
          ))}
        </span>
      </p>
    </nav>
  );
}
