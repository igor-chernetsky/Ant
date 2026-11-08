import { translate, type Locale } from '@/lib/i18n';
import { GuestHeroActions } from '@/components/GuestHeroActions';

interface GuestHeroProps {
  locale: Locale;
}

/**
 * First screen for a visitor without a session.
 *
 * Rendered on the server (see `app/page.tsx`): the offer is in the first HTML, the
 * project grid stays right below it, and nothing shifts after hydration. It sits
 * inside the results column, so on wide screens it covers the grid only — the
 * filters sidebar starts at the top instead of leaving an empty gap beside it.
 *
 * The photo sits on the right and fades to transparent towards the left, so it
 * melts into the gradient instead of ending on a hard edge.
 */
export function GuestHero({ locale }: GuestHeroProps) {
  return (
    <section className="guest-hero" aria-labelledby="guest-hero-title">
      <div className="guest-hero-media" aria-hidden />
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
