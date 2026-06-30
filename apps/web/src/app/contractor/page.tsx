'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ContractorVerificationPanel } from '@/components/ContractorVerificationPanel';
import { ContractorPortfolioPanel } from '@/components/ContractorPortfolioPanel';
import { LoginModal } from '@/components/LoginModal';
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
import { formatThb } from '@/lib/estimate';
import { fetchPublicTags } from '@/lib/public-projects';
import {
  fetchContractorApplications,
  fetchContractorProfile,
  formatContractorParticipationLabel,
  formatTenderStatus,
  upsertContractorProfile,
  type ContractorApplicationItem,
  type ContractorProfile,
} from '@/lib/tendering';

export default function ContractorPage() {
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
    if (prof?.companyName) setCompanyName(prof.companyName);
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
      setError(err instanceof Error ? err.message : 'Failed to load');
      setReady(true);
    });
  }, [sessionReady, loadAll]);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
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

  return (
    <PageShell>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main className="content-container main-content">
        <section className="page-hero">
          <h1>Contractor portal</h1>
          <p className="page-hero-lead muted">
            Register as a contractor, browse open projects, and submit
            applications with direct chat to the client.
          </p>
        </section>

        {!ready && (
          <section className="card">
            <p className="muted">Loading…</p>
          </section>
        )}

        {ready && !me && (
          <section className="card cta">
            <p>Sign in to browse projects and submit applications.</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              Sign in
            </button>
          </section>
        )}

        {ready && me && !profile && (
          <section className="card">
            <h2 className="section-title">Register as contractor</h2>
            <p className="muted doc-hint">
              Tell us what trades you cover. You can update specialties anytime.
            </p>
            <div className="modal-form">
              <label>
                Company name
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company"
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
                <p className="muted">Loading locations…</p>
              )}
              <fieldset className="tag-fieldset">
                <legend>Your specialties</legend>
                <p className="muted tag-hint">
                  Optional. Leave empty to see all projects on the home page.
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
              {busy ? 'Saving…' : 'Create contractor profile'}
            </button>
          </section>
        )}

        {ready && me && profile && (
          <>
            <section className="card">
              <h2 className="section-title">Your profile</h2>
              <p className="muted doc-hint">
                Update company details, service areas, and the trades you want to work on.
              </p>
              <div className="modal-form">
                <label>
                  Company name
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your company"
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
                  <p className="muted">Loading locations…</p>
                )}
                <fieldset className="tag-fieldset">
                  <legend>Your specialties</legend>
                  <p className="muted tag-hint">
                    {selectedTagLabels
                      ? `Selected: ${selectedTagLabels}`
                      : 'None selected — home page shows all projects.'}
                    {serviceLocationSummary
                      ? ` · Notifications: ${serviceLocationSummary}`
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
                {busy ? 'Saving…' : 'Save profile'}
              </button>
            </section>

            <ContractorVerificationPanel
              profile={profile}
              onProfileUpdated={setProfile}
            />

            <ContractorPortfolioPanel />

            <section className="card">
              <h2 className="section-title">My applications</h2>
              {applications.length === 0 ? (
                <p className="muted">
                  No applications yet. Browse{' '}
                  <Link href="/" className="text-link">
                    open projects
                  </Link>{' '}
                  and submit a bid when the client publishes for bidding.
                </p>
              ) : (
                <ul className="tender-invite-list">
                  {applications.map((app) => (
                    <li key={app.bidId} className="tender-invite-item">
                      <div>
                        <strong>{app.projectTitle}</strong>
                        <p className="muted doc-meta">
                          {app.projectDistrict ?? app.projectId} ·{' '}
                          {formatTenderStatus(app.tenderStatus)} ·{' '}
                          {formatContractorParticipationLabel(app)}
                          {app.bidAmount
                            ? ` · ${formatThb(Number(app.bidAmount))}`
                            : ''}
                        </p>
                      </div>
                      <div className="bid-line-actions">
                        <Link
                          href={`/projects/${app.projectId}`}
                          className="text-link"
                        >
                          View project
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
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
