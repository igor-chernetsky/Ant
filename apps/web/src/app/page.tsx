'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoginModal } from '@/components/LoginModal';
import { SiteHeader } from '@/components/SiteHeader';
import {
  fetchSessionProfile,
  logoutSession,
  type MeResponse,
} from '@/lib/session';

type AuthState = 'loading' | 'guest' | 'authenticated';

export default function HomePage() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const refreshSession = useCallback(async () => {
    setError(null);
    const profile = await fetchSessionProfile();
    if (profile) {
      setMe(profile);
      setAuthState('authenticated');
    } else {
      setMe(null);
      setAuthState('guest');
    }
  }, []);

  useEffect(() => {
    refreshSession().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load session');
      setAuthState('guest');
    });
  }, [refreshSession]);

  const handleLogout = async () => {
    setError(null);
    await logoutSession();
    setMe(null);
    setAuthState('guest');
  };

  return (
    <>
      <SiteHeader
        me={me}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleLogout}
      />

      <main>
        <section className="hero card">
          <h1>Plan and manage construction projects in one place</h1>
          <p className="muted">
            Browse how the platform works as a guest. Sign in to create
            projects, request estimates, and manage tenders.
          </p>
        </section>

        <section className="card">
          <h2 className="section-title">For homeowners</h2>
          <ul className="feature-list">
            <li>Describe your renovation or build with AI-assisted intake</li>
            <li>Get preliminary cost estimates from local market data</li>
            <li>Compare contractor bids in a structured format</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="section-title">For contractors</h2>
          <ul className="feature-list">
            <li>Receive pre-screened tender invitations</li>
            <li>Ask clarifying questions before submitting a bid</li>
            <li>Track project updates and communication in one workspace</li>
          </ul>
        </section>

        {authState === 'guest' && (
          <section className="card cta">
            <p>Ready to start a project?</p>
            <button
              type="button"
              className="primary"
              onClick={() => setLoginOpen(true)}
            >
              Sign in to continue
            </button>
          </section>
        )}

        {authState === 'loading' && (
          <section className="card">
            <p className="muted">Checking session…</p>
          </section>
        )}

        {error && (
          <section className="card error">
            <pre>{error}</pre>
          </section>
        )}

        {authState === 'authenticated' && me && (
          <section className="card">
            <h2 className="section-title">Your account</h2>
            <pre>{JSON.stringify(me, null, 2)}</pre>
          </section>
        )}
      </main>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={refreshSession}
      />
    </>
  );
}
