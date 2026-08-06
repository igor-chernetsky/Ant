'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ContractorApplicationTile } from '@/components/ContractorApplicationTile';
import { ContractorReviewsPanel } from '@/components/ContractorReviewsPanel';
import { ContractorVerificationPanel } from '@/components/ContractorVerificationPanel';
import { ContractorPortfolioPanel } from '@/components/ContractorPortfolioPanel';
import { HelpTip } from '@/components/help/HelpTip';
import { LoginModal } from '@/components/LoginModal';
import { useTranslation } from '@/components/LocaleProvider';
import { PageShell } from '@/components/PageShell';
import { ProjectTypePicker } from '@/components/ProjectTypePicker';
import { ServiceLocationEditor } from '@/components/ServiceLocationEditor';
import { SiteHeader } from '@/components/SiteHeader';
import { TradeTagPicker } from '@/components/TradeTagPicker';
import { useSession } from '@/components/SessionProvider';
import { HELP_TIP_IDS } from '@/lib/help-tips';
import {
  DEFAULT_SERVICE_LOCATION,
  fetchLocationCatalog,
  formatServiceLocation,
  type LocationCatalog,
  type ServiceLocation,
} from '@/lib/locations';
import {
  PROJECT_TYPE_OPTIONS,
  type ProjectType,
} from '@/lib/projects';
import { fetchPublicTags } from '@/lib/public-projects';
import {
  fetchContractorApplications,
  fetchContractorProfile,
  upsertContractorProfile,
  type ContractorApplicationItem,
  type ContractorProfile,
} from '@/lib/tendering';

function isProjectType(value: string): value is ProjectType {
  return PROJECT_TYPE_OPTIONS.some((option) => option.value === value);
}

export default function DesignerPage() {
  const { t } = useTranslation();
  const { me, ready: sessionReady, refreshSession, signOut } = useSession();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [applications, setApplications] = useState<ContractorApplicationItem[]>(
    [],
  );
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [locationCatalog, setLocationCatalog] = useState<LocationCatalog | null>(
    null,
  );
  const [serviceLocations, setServiceLocations] = useState<ServiceLocation[]>([
    DEFAULT_SERVICE_LOCATION,
  ]);
  const [selectedProjectTypes, setSelectedProjectTypes] = useState<
    ProjectType[]
  >([]);
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

  const specialtyTags = useMemo(
    () => tradeTags.filter((tag) => tag.groupSlug !== 'service'),
    [tradeTags],
  );

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
    setPhone(prof?.phone ?? '');
    setBankName(prof?.bankName ?? '');
    setBankAccount(prof?.bankAccount ?? '');
    if (prof?.serviceLocations?.length) {
      setServiceLocations(prof.serviceLocations);
    }
    if (prof?.projectTypes?.length) {
      setSelectedProjectTypes(prof.projectTypes.filter(isProjectType));
    } else {
      setSelectedProjectTypes([]);
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
        phone: phone.trim() || null,
        bankName: bankName.trim() || null,
        bankAccount: bankAccount.trim() || null,
        serviceLocations,
        projectTypes: selectedProjectTypes,
        tagSlugs: selectedTagSlugs,
        kind: 'designer',
      });
      setProfile(prof);
      setServiceLocations(prof.serviceLocations);
      setPhone(prof.phone ?? '');
      setBankName(prof.bankName ?? '');
      setBankAccount(prof.bankAccount ?? '');
      setSelectedProjectTypes(prof.projectTypes.filter(isProjectType));
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
    .map((slug) => specialtyTags.find((tag) => tag.slug === slug)?.label ?? slug)
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
    (app) => app.projectStatus === 'completed' && app.projectType === 'design',
  );
  const designApplications = applications.filter(
    (app) => app.projectType === 'design',
  );
  const visibleApplications = showCompletedApplications
    ? designApplications
    : designApplications.filter((app) => app.projectStatus !== 'completed');

  const renderProfileForm = () => (
    <div className="portal-profile-form">
      <div className="portal-profile-col">
        <div className="portal-profile-contact">
          <div className="form-row">
            <label>
              <span className="portal-field-title">
                {t('account.companyName')}
              </span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t('contractor.companyPlaceholder')}
              />
            </label>
            <label>
              <span className="portal-field-title">
                {t('contractor.phoneLabel')}
                <span className="portal-field-optional">
                  {t('common.optional')}
                </span>
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('contractor.phonePlaceholder')}
                autoComplete="tel"
              />
            </label>
          </div>
          <p className="muted tag-hint portal-contact-hint">
            {t('contractor.bankOptionalHint')}
          </p>
          <div className="form-row">
            <label>
              <span className="portal-field-title">
                {t('contractor.bankNameLabel')}
              </span>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder={t('contractor.bankNamePlaceholder')}
                autoComplete="organization"
              />
            </label>
            <label>
              <span className="portal-field-title">
                {t('contractor.bankAccountLabel')}
              </span>
              <input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder={t('contractor.bankAccountPlaceholder')}
                inputMode="numeric"
                autoComplete="off"
              />
            </label>
          </div>
        </div>
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
      </div>
      <div className="portal-profile-col">
        <fieldset className="tag-fieldset">
          <legend>{t('contractor.projectTypesLegend')}</legend>
          <p className="muted tag-hint">{t('contractor.projectTypesHint')}</p>
          <ProjectTypePicker
            options={PROJECT_TYPE_OPTIONS}
            selected={selectedProjectTypes}
            onChange={setSelectedProjectTypes}
            disabled={busy}
          />
        </fieldset>
        <fieldset className="tag-fieldset">
          <legend>{t('contractor.specialtiesLegend')}</legend>
          <p className="muted tag-hint">
            {profile
              ? selectedTagLabels
                ? t('contractor.specialtiesSelected', {
                    tags: selectedTagLabels,
                  })
                : t('contractor.specialtiesNone')
              : t('contractor.specialtiesHintOptional')}
            {profile && serviceLocationSummary
              ? t('contractor.specialtiesNotifications', {
                  locations: serviceLocationSummary,
                })
              : ''}
          </p>
          <TradeTagPicker
            tags={specialtyTags}
            selected={selectedTagSlugs}
            onChange={setSelectedTagSlugs}
            disabled={busy}
          />
        </fieldset>
      </div>
    </div>
  );

  return (
    <PageShell className="page-shell--portal">
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main className="portal-main main-content">
        <section className="page-hero portal-hero">
          <h1>{t('designer.portalTitle')}</h1>
          <p className="page-hero-lead muted">{t('designer.portalLead')}</p>
        </section>

        {!ready && (
          <section className="card">
            <p className="muted">{t('common.loading')}</p>
          </section>
        )}

        {ready && !me && (
          <section className="card cta">
            <p>{t('designer.signInPrompt')}</p>
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
            <HelpTip
              tipId={HELP_TIP_IDS.designerRegister}
              title={t('help.tipDesignerRegisterTitle')}
              body={t('help.tipDesignerRegisterBody')}
              learnMoreHref="/help#designer-profile"
            />
            <h2 className="section-title">{t('designer.registerTitle')}</h2>
            <p className="muted doc-hint">{t('designer.registerHint')}</p>
            {renderProfileForm()}
            {error && <p className="form-error">{error}</p>}
            <button
              type="button"
              className="primary profile-form-submit"
              disabled={busy}
              onClick={() => void handleRegister()}
            >
              {busy ? t('common.saving') : t('designer.createProfile')}
            </button>
          </section>
        )}

        {ready && me && profile && (
          <>
            <section className="card portal-profile-card">
              <h2 className="section-title">{t('designer.yourProfile')}</h2>
              <p className="muted doc-hint">{t('designer.profileHint')}</p>
              {renderProfileForm()}
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

            <div className="portal-layout">
              <div className="portal-primary">
                <ContractorVerificationPanel
                  profile={profile}
                  onProfileUpdated={setProfile}
                />
              </div>

              <div className="portal-secondary">
                <ContractorPortfolioPanel />
                <ContractorReviewsPanel />
              </div>
            </div>

            <section className="card portal-applications">
              <div className="contractor-section-header">
                <h2 className="section-title">{t('contractor.myApplications')}</h2>
                {designApplications.length > 0 &&
                  completedApplications.length > 0 && (
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
              {designApplications.length === 0 ? (
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
                    <ContractorApplicationTile
                      key={app.bidId}
                      application={app}
                    />
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
