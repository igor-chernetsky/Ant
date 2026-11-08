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

/**
 * The two doors of the hero, side by side on wide screens and stacked on phones.
 *
 * The platform is two-sided, so the panel asks one question — client or
 * contractor — instead of offering three overlapping paths. Each column keeps its
 * own call to action: the client starts with a free estimate (registration comes
 * at publication), the contractor looks at real projects first and only registers
 * to respond.
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
        <div className="guest-hero-column-actions">
          <button
            type="button"
            className="guest-hero-browse"
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
      </section>
    </div>
  );
}
