'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ContractorApplicationTile } from '@/components/ContractorApplicationTile';
import { ContractorReviewsPanel } from '@/components/ContractorReviewsPanel';
import { ContractorVerificationPanel } from '@/components/ContractorVerificationPanel';
import { ContractorPortfolioPanel } from '@/components/ContractorPortfolioPanel';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { ServiceLocationEditor } from '@/components/ServiceLocationEditor';
import { SiteHeader } from '@/components/SiteHeader';
import { TradeTagPicker } from '@/components/TradeTagPicker';
import { useSession } from '@/components/SessionProvider';
import {
  DEFAULT_SERVICE_LOCATION,
  fetchLocationCatalog,
  formatServiceLocation,
  type LocationCatalog,
  type ServiceLocation,
} from '@/lib/locations';
import { fetchPublicTags } from '@/lib/public-projects';
import {
  fetchContractorApplications,
  fetchContractorProfile,
  upsertContractorProfile,
  type ContractorApplicationItem,
  type ContractorProfile,
} from '@/lib/tendering';

export default function ContractorPage() {
  const { t } = useTranslation();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [applications, setApplications] = useState<ContractorApplicationItem[]>(
    [],
  );
  const [companyName, setCompanyName] = useState('');
  const [locationCatalog, setLocationCatalog] = useState<LocationCatalog | null>(
    null,
  );
  const [serviceLocations, setServiceLocations] = useState<ServiceLocation[]>([
    DEFAULT_SERVICE_LOCATION,
  ]);
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>([]);
  const [tradeTags, setTradeTags] = useState<
    Array<{
      slug: string;
      label: string;
      groupSlug: string | null;
      groupLabel: string | null;
    }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [showCompletedApplications, setShowCompletedApplications] =
    useState(false);

  const loadAll = useCallback(async () => {
    setError(null);
    if (!sessionReady) return;
    if (!me) {
      setReady(true);
      return;
    }

    const [prof, apps, tags, locations] = await Promise.all([
      fetchContractorProfile(),
      fetchContractorApplications(),
      fetchPublicTags(),
      fetchLocationCatalog(),
    ]);
    setTradeTags(tags);
    setLocationCatalog(locations);
    setProfile(prof);
    setApplications(apps);
    if (prof?.companyName) {
      setCompanyName(prof.companyName);
    } else if (me.displayName) {
      setCompanyName(me.displayName);
    }
    if (prof?.serviceLocations?.length) {
      setServiceLocations(prof.serviceLocations);
    }
    if (prof?.tagSlugs) setSelectedTagSlugs(prof.tagSlugs);
    setReady(true);
  }, [me, sessionReady]);

  useEffect(() => {
    if (!sessionReady || me) return;
    void Promise.all([fetchPublicTags(), fetchLocationCatalog()])
      .then(([tags, locations]) => {
        setTradeTags(tags);
        setLocationCatalog(locations);
      })
      .catch(() => {
        setTradeTags([]);
        setLocationCatalog(null);
      });
  }, [sessionReady, me]);

  useEffect(() => {
    if (!sessionReady) return;
    loadAll().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t('contractor.loadFailed'));
      setReady(true);
    });
  }, [sessionReady, loadAll, t]);

  const handleSaveProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      const prof = await upsertContractorProfile({
        companyName: companyName.trim() || undefined,
        serviceLocations,
        tagSlugs: selectedTagSlugs,
      });
      setProfile(prof);
      setServiceLocations(prof.serviceLocations);
      setSelectedTagSlugs(prof.tagSlugs);
      await refreshSession();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('contractor.saveProfileFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    await handleSaveProfile();
  };

  const selectedTagLabels = selectedTagSlugs
    .map((slug) => tradeTags.find((tag) => tag.slug === slug)?.label ?? slug)
    .join(', ');

  const serviceLocationSummary =
    locationCatalog && serviceLocations.length > 0
      ? serviceLocations
          .map((location) => formatServiceLocation(locationCatalog, location))
          .join('; ')
      : '';

  const handleLogout = async () => {
    await signOut();
    setProfile(null);
    setApplications([]);
  };

  const completedApplications = applications.filter(
    (app) => app.projectStatus === 'completed',
  );
  const visibleApplications = showCompletedApplications
    ? applications
    : applications.filter((app) => app.projectStatus !== 'completed');

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main className="content-container main-content">
        <section className="page-hero">
          <h1>{t('contractor.portalTitle')}</h1>
          <p className="page-hero-lead muted">{t('contractor.portalLead')}</p>
        </section>

        {!ready && (
          <section className="card">
            <p className="muted">{t('common.loading')}</p>
          </section>
        )}

        {ready && !me && (
          <section className="card cta">
            <p>{t('contractor.signInPrompt')}</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              {t('header.signIn')}
            </button>
          </section>
        )}

        {ready && me && !profile && (
          <section className="card">
            <h2 className="section-title">{t('contractor.registerTitle')}</h2>
            <p className="muted doc-hint">{t('contractor.registerHint')}</p>
            <div className="modal-form">
              <label>
                {t('account.companyName')}
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t('contractor.companyPlaceholder')}
                />
              </label>
              {locationCatalog ? (
                <ServiceLocationEditor
                  catalog={locationCatalog}
                  value={serviceLocations}
                  onChange={setServiceLocations}
                  disabled={busy}
                />
              ) : (
                <p className="muted">{t('contractor.loadingLocations')}</p>
              )}
              <fieldset className="tag-fieldset">
                <legend>{t('contractor.specialtiesLegend')}</legend>
                <p className="muted tag-hint">
                  {t('contractor.specialtiesHintOptional')}
                </p>
                <TradeTagPicker
                  tags={tradeTags}
                  selected={selectedTagSlugs}
                  onChange={setSelectedTagSlugs}
                  disabled={busy}
                />
              </fieldset>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button
              type="button"
              className="primary profile-form-submit"
              disabled={busy}
              onClick={() => void handleRegister()}
            >
              {busy ? t('common.saving') : t('contractor.createProfile')}
            </button>
          </section>
        )}

        {ready && me && profile && (
          <>
            <section className="card">
              <h2 className="section-title">{t('contractor.yourProfile')}</h2>
              <p className="muted doc-hint">{t('contractor.profileHint')}</p>
              <div className="modal-form">
                <label>
                  {t('account.companyName')}
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t('contractor.companyPlaceholder')}
                  />
                </label>
                {locationCatalog ? (
                  <ServiceLocationEditor
                    catalog={locationCatalog}
                    value={serviceLocations}
                    onChange={setServiceLocations}
                    disabled={busy}
                  />
                ) : (
                  <p className="muted">{t('contractor.loadingLocations')}</p>
                )}
                <fieldset className="tag-fieldset">
                  <legend>{t('contractor.specialtiesLegend')}</legend>
                  <p className="muted tag-hint">
                    {selectedTagLabels
                      ? t('contractor.specialtiesSelected', {
                          tags: selectedTagLabels,
                        })
                      : t('contractor.specialtiesNone')}
                    {serviceLocationSummary
                      ? t('contractor.specialtiesNotifications', {
                          locations: serviceLocationSummary,
                        })
                      : ''}
                  </p>
                  <TradeTagPicker
                    tags={tradeTags}
                    selected={selectedTagSlugs}
                    onChange={setSelectedTagSlugs}
                    disabled={busy}
                  />
                </fieldset>
              </div>
              {error && <p className="form-error">{error}</p>}
              <button
                type="button"
                className="primary profile-form-submit"
                disabled={busy}
                onClick={() => void handleSaveProfile()}
              >
                {busy ? t('common.saving') : t('contractor.saveProfile')}
              </button>
            </section>

            <ContractorVerificationPanel
              profile={profile}
              onProfileUpdated={setProfile}
            />

            <ContractorPortfolioPanel />

            <ContractorReviewsPanel />

            <section className="card">
              <div className="contractor-section-header">
                <h2 className="section-title">{t('contractor.myApplications')}</h2>
                {applications.length > 0 && completedApplications.length > 0 && (
                  <label className="contractor-toggle">
                    <input
                      type="checkbox"
                      checked={showCompletedApplications}
                      onChange={(event) =>
                        setShowCompletedApplications(event.target.checked)
                      }
                    />
                    {t('contractor.showCompleted')}
                  </label>
                )}
              </div>
              {applications.length === 0 ? (
                <p className="muted">
                  {t('contractor.noApplicationsBefore')}{' '}
                  <Link href="/" className="text-link">
                    {t('common.openProjects')}
                  </Link>{' '}
                  {t('contractor.noApplicationsAfter')}
                </p>
              ) : visibleApplications.length === 0 ? (
                <p className="muted">
                  {t('contractor.noActiveApplicationsPrefix')}{' '}
                  <strong>{t('contractor.showCompleted')}</strong>{' '}
                  {t('contractor.noActiveApplicationsSuffix', {
                    count: completedApplications.length,
                  })}
                </p>
              ) : (
                <div
                  className="project-grid"
                  aria-label={t('contractor.applicationsAria')}
                >
                  {visibleApplications.map((app) => (
                    <ContractorApplicationTile key={app.bidId} application={app} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          void (async () => {
            await refreshSession();
            await loadAll();
          })();
        }}
      />
    </PageShell>
  );
}
