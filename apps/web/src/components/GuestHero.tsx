import { translate, type Locale } from '@/lib/i18n';
import { GuestHeroActions } from '@/components/GuestHeroActions';

interface GuestHeroProps {
  locale: Locale;
}

/**
 * First screen for a visitor without a session.
 *
 * Rendered on the server (see `app/page.tsx`): the visitor who arrives from an ad
 * gets the offer in the first HTML, the project grid stays right below it, and
 * nothing shifts after hydration. Client actions are delegated to
 * `GuestHeroActions` through custom events.
 */
export function GuestHero({ locale }: GuestHeroProps) {
  return (
    <section className="card guest-hero" aria-labelledby="guest-hero-title">
      <div className="guest-hero-copy">
        <h1 id="guest-hero-title" className="guest-hero-title">
          {translate(locale, 'home.heroTitle')}
        </h1>
        <p className="guest-hero-lead">
          {translate(locale, 'home.heroLead')}
        </p>
        <GuestHeroActions />
        <p className="guest-hero-sub">
          {translate(locale, 'home.heroSubLead')}
        </p>
      </div>
    </section>
  );
}
