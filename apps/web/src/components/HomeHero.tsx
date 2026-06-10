'use client';

import Link from 'next/link';

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
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-overlay">
        <div className="home-hero-content">
          <p className="home-hero-kicker">Ant marketplace</p>
          <h1 id="home-hero-title">Construction projects</h1>
          <p className="home-hero-lead">
            Browse renovation and build opportunities. Publish your project,
            receive ballpark estimates, and collect contractor proposals.
          </p>
          <div className="home-hero-actions">
            {canAddProject ? (
              <button type="button" className="primary" onClick={onAddProject}>
                Add project
              </button>
            ) : !signedIn ? (
              <button type="button" className="primary" onClick={onSignIn}>
                Sign in to publish
              </button>
            ) : null}
            {showContractorPortal && (
              <Link href="/contractor" className="home-hero-link">
                Contractor portal
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
