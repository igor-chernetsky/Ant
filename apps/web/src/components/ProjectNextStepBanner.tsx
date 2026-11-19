'use client';

import { useTranslation } from '@/components/LocaleProvider';
import type { ProjectNextStep } from '@/lib/project-next-step';

/**
 * Single "what now" banner for the client's project page.
 *
 * The page is a stack of cards (documents, questions, estimate, tender) and had no
 * answer to "what am I supposed to do next". The banner names the next action and
 * jumps to the card that performs it, so the order of the stack matters less.
 */
export function ProjectNextStepBanner({
  step,
  onSignUp,
  onOpenProposals,
}: {
  step: ProjectNextStep;
  /** Guest owner: publishing needs an account, the caller opens the sign-up modal. */
  onSignUp?: () => void;
  /** Tender stage: proposals live on their own page. */
  onOpenProposals?: () => void;
}) {
  const { t } = useTranslation();

  const scrollToTarget = () => {
    if (!step.targetId) {
      return;
    }
    const element = document.getElementById(step.targetId);
    if (!element) {
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element.focus?.();
  };

  const handleAction = () => {
    if (step.key === 'signup') {
      onSignUp?.();
      return;
    }
    if (step.key === 'waiting') {
      onOpenProposals?.();
      return;
    }
    scrollToTarget();
  };

  return (
    <section
      className={`card project-next-step project-next-step--${step.key}`}
      aria-labelledby="project-next-step-title"
    >
      <div className="project-next-step-body">
        <p className="project-next-step-progress">
          {t('projectNextStep.stepOf', {
            current: step.step,
            total: step.total,
          })}
        </p>
        <h2 className="section-title" id="project-next-step-title">
          {t(`projectNextStep.${step.key}Title`)}
        </h2>
        <p className="muted project-next-step-text">
          {t(`projectNextStep.${step.key}Body`)}
        </p>
      </div>
      <button type="button" className="primary" onClick={handleAction}>
        {t(`projectNextStep.${step.key}Cta`)}
      </button>
    </section>
  );
}
