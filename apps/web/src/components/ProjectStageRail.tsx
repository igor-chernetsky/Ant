'use client';

import { useTranslation } from '@/components/LocaleProvider';
import {
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
              <span className="project-stage-rail-marker" aria-hidden />
              <span className="project-stage-rail-label">
                {t(`projectStage.${stage.id}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
