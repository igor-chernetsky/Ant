'use client';

import { useTranslation } from '@/components/LocaleProvider';

const STAGES = [
  {
    id: 'setup',
    statuses: ['draft', 'intake', 'ready_for_estimate'],
  },
  {
    id: 'estimate',
    statuses: ['estimated'],
  },
  {
    id: 'tender',
    statuses: ['in_tender'],
  },
  {
    id: 'award',
    statuses: ['awarded'],
  },
  {
    id: 'delivery',
    statuses: ['active', 'completed'],
  },
] as const;

interface ProjectStageRailProps {
  status: string;
}

function stageIndexForStatus(status: string): number {
  const index = STAGES.findIndex((stage) =>
    (stage.statuses as readonly string[]).includes(status),
  );
  return index >= 0 ? index : 0;
}

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
