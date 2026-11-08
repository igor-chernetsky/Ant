'use client';

import { useTranslation } from '@/components/LocaleProvider';
import { AnalyticsEvents, trackLandingEvent } from '@/lib/analytics';

/**
 * Clicks that a server-rendered hero must hand over to the client shell.
 *
 * The hero itself is rendered on the server (guest-only, no layout shift), while
 * the create modal and the project filters live in `HomePageClient`. A custom
 * event keeps that split without pulling the whole home page back into the client
 * tree or forcing a reload.
 */
export const OPEN_CREATE_EVENT = 'ant:open-create';
export const BROWSE_CONTRACTOR_EVENT = 'ant:browse-contractor';

function emit(name: string, detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export interface GuestHeroActionsProps {
  className?: string;
}

export function GuestHeroActions({ className = '' }: GuestHeroActionsProps) {
  const { t } = useTranslation();

  return (
    <div className={`guest-hero-actions${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="primary guest-hero-cta"
        onClick={() => {
          trackLandingEvent(AnalyticsEvents.ctaClick, {
            placement: 'hero_estimate',
            is_guest: true,
          });
          emit(OPEN_CREATE_EVENT, { placement: 'hero_estimate' });
        }}
      >
        {t('home.heroEstimateCta')}
      </button>

      <div className="guest-hero-contractor">
        <span className="guest-hero-contractor-title">
          {t('home.heroContractorTitle')}
        </span>
        <button
          type="button"
          className="guest-hero-link"
          onClick={() => {
            trackLandingEvent(AnalyticsEvents.ctaClick, {
              placement: 'hero_contractor_browse',
              is_guest: true,
            });
            emit(BROWSE_CONTRACTOR_EVENT, {});
          }}
        >
          {t('home.heroContractorBrowse')}
        </button>
        <a
          className="guest-hero-link guest-hero-link--muted"
          href="/?role=contractor"
          onClick={() => {
            trackLandingEvent(AnalyticsEvents.ctaClick, {
              placement: 'hero_contractor_signup',
              is_guest: true,
            });
          }}
        >
          {t('home.heroContractorSignup')}
        </a>
      </div>
    </div>
  );
}
