'use client';

import { useTranslation } from '@/components/LocaleProvider';

interface ProjectCompletionBannerProps {
  /** Winning contractor name, when the API could resolve one. */
  contractorName: string | null;
  /** Opens the completion review modal, where the client confirms. */
  onConfirm: () => void;
}

/**
 * Shown at the top of the project page once the contractor has requested
 * completion: the client's confirmation is then the only remaining step.
 *
 * It has no dismiss control on purpose — hiding it would only hide the action
 * the client still owes.
 */
export function ProjectCompletionBanner({
  contractorName,
  onConfirm,
}: ProjectCompletionBannerProps) {
  const { t } = useTranslation();

  return (
    <aside
      className="project-completion-banner"
      role="status"
      aria-live="polite"
    >
      <div className="project-completion-banner-inner">
        <span className="project-completion-banner-icon" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.5 11.1V12a9.5 9.5 0 1 1-5.6-8.6" />
            <path d="M21.5 4.5 12 14l-3-3" />
          </svg>
        </span>

        <div className="project-completion-banner-copy">
          <strong className="project-completion-banner-title">
            {t('lifecycle.readyBannerTitle')}
          </strong>
          <p className="project-completion-banner-text">
            {t('lifecycle.readyBannerText', {
              name:
                contractorName ??
                t('lifecycle.readyBannerContractorFallback'),
            })}
          </p>
        </div>

        <button
          type="button"
          className="primary project-completion-banner-cta"
          onClick={onConfirm}
        >
          {t('lifecycle.confirmCompletion')}
        </button>
      </div>
    </aside>
  );
}
