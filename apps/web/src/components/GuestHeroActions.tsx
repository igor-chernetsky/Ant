'use client';

import { useTranslation } from '@/components/LocaleProvider';
import { AnalyticsEvents, trackLandingEvent } from '@/lib/analytics';

/**
 * Clicks that a server-rendered hero must hand over to the client shell.
 *
 * The hero itself is rendered on the server (guest-only, no layout shift), while
 * the create modal, the sign-up dialog and the project filters live in
 * `HomePageClient`. Custom events keep that split without pulling the whole home
 * page back into the client tree or forcing a reload.
 */
export const OPEN_CREATE_EVENT = 'ant:open-create';
export const OPEN_SIGNUP_EVENT = 'ant:open-signup';

function emit(name: string, detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * The two doors of the hero, side by side on wide screens and stacked on phones.
 *
 * The platform is two-sided, so the panel asks one question — client or
 * contractor — and each column has exactly one call to action: the client starts
 * with a free estimate (registration comes at publication), the contractor opens
 * the sign-up dialog with that role already selected.
 */
export function GuestHeroActions() {
  const { t } = useTranslation();

  return (
    <div className="guest-hero-columns">
      <section className="guest-hero-column guest-hero-column--client">
        <h2 className="guest-hero-column-title">
          {t('home.heroClientTitle')}
        </h2>
        <p className="guest-hero-column-lead">{t('home.heroClientLead')}</p>
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
      </section>

      <section className="guest-hero-column guest-hero-column--contractor">
        <h2 className="guest-hero-column-title">
          {t('home.heroContractorTitle')}
        </h2>
        <p className="guest-hero-column-lead">
          {t('home.heroContractorLead')}
        </p>
        <button
          type="button"
          className="guest-hero-signup"
          onClick={() => {
            trackLandingEvent(AnalyticsEvents.ctaClick, {
              placement: 'hero_contractor_signup',
              is_guest: true,
            });
            emit(OPEN_SIGNUP_EVENT, { role: 'contractor' });
          }}
        >
          {t('home.heroContractorSignup')}
        </button>
      </section>
    </div>
  );
}
