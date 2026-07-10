'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/LocaleProvider';

interface HomeHeroProps {
  signedIn: boolean;
  canAddProject: boolean;
  showContractorPortal?: boolean;
  onAddProject: () => void;
  onSignIn: () => void;
}

export function HomeHero({
  signedIn,
  canAddProject,
  showContractorPortal = false,
  onAddProject,
  onSignIn,
}: HomeHeroProps) {
  const { t } = useTranslation();

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-overlay">
        <div className="home-hero-content">
          <p className="home-hero-kicker">{t('home.kicker')}</p>
          <h1 id="home-hero-title">{t('home.title')}</h1>
          <p className="home-hero-lead">{t('home.lead')}</p>
          <div className="home-hero-actions">
            {canAddProject ? (
              <button type="button" className="primary" onClick={onAddProject}>
                {t('home.addProject')}
              </button>
            ) : !signedIn ? (
              <button type="button" className="primary" onClick={onSignIn}>
                {t('home.signInToPublish')}
              </button>
            ) : null}
            {showContractorPortal && (
              <Link href="/contractor" className="home-hero-link">
                {t('home.contractorPortal')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
