'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { SiteHeader } from '@/components/SiteHeader';
import { useSession } from '@/components/SessionProvider';
import {
  filterMarketplacesByCategory,
  MATERIAL_CATEGORIES,
  type MaterialCategory,
} from '@/lib/materials-marketplaces';
import { MaterialsMarketplaceCard } from '@/components/MaterialsMarketplaceCard';

export default function MaterialsMarketplacesPage() {
  const { t } = useTranslation();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);
  const [category, setCategory] = useState<MaterialCategory | null>(null);

  const platforms = useMemo(
    () => filterMarketplacesByCategory(category),
    [category],
  );

  return (
    <PageShell>
      <SiteHeader
        me={sessionReady ? me : null}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={() => void signOut()}
      />

      <main className="content-container main-content materials-page">
        <p className="account-page-kicker">
          <Link href="/" className="project-hero-back-link">
            {t('common.home')}
          </Link>
          <span className="project-hero-kicker-sep">/</span>
          <span>{t('materials.breadcrumb')}</span>
        </p>

        <header className="materials-page-header">
          <h1>{t('materials.title')}</h1>
          <p className="materials-page-lead muted">{t('materials.lead')}</p>
        </header>

        <section
          className="materials-filters"
          aria-label={t('materials.filtersAria')}
        >
          <button
            type="button"
            className={`filter-chip${category === null ? ' filter-chip-active' : ''}`}
            onClick={() => setCategory(null)}
          >
            {t('materials.filterAll')}
          </button>
          {MATERIAL_CATEGORIES.map((slug) => (
            <button
              key={slug}
              type="button"
              className={`filter-chip${
                category === slug ? ' filter-chip-active' : ''
              }`}
              onClick={() =>
                setCategory((current) => (current === slug ? null : slug))
              }
            >
              {t(`materials.categories.${slug}`)}
            </button>
          ))}
        </section>

        {platforms.length === 0 ? (
          <section className="card empty-state">
            <p>{t('materials.empty')}</p>
          </section>
        ) : (
          <section
            className="project-grid materials-grid"
            aria-label={t('materials.gridAria')}
          >
            {platforms.map((platform) => (
              <MaterialsMarketplaceCard key={platform.id} platform={platform} />
            ))}
          </section>
        )}
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={async () => {
          setLoginOpen(false);
          await refreshSession();
        }}
      />
    </PageShell>
  );
}
